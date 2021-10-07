import { Connection } from '@solana/web3.js';
import * as switchboard from '@switchboard-xyz/switchboard-api';
import invariant from 'tiny-invariant';
import { DECIMAL_MULT, LP_SWAP_INFO } from '../constants';
import { AppConfig, PoolConfig, TokenID } from '../types';
import Decimal from "decimal.js";

export class PriceInfo {
  constructor(
    public config: AppConfig,
  ) {}

  async fetchPrice(tokId: TokenID, connection: Connection): Promise<number> {
    if (tokId in this.config.switchboardPriceKeys) {
      return this.fetchViaSwitchboard(tokId, connection);
    }
    else {
      invariant(tokId in this.config.poolConfigs);
      const poolConfig = this.config.poolConfigs[tokId]!;
      invariant(poolConfig.isLp(), "volatile/stable tokens should be priced through switchboard");
      return this.computeLpPrice(tokId, poolConfig, connection);
    }
  }

  async fetchViaSwitchboard(tokId: TokenID, connection: Connection): Promise<number> {
    const key = this.config.switchboardPriceKeys[tokId]!;
    invariant(key, `${tokId} not available through switchboard`);
    const data = await switchboard.parseAggregatorAccountData(connection, key);
    let price = data.currentRoundResult?.result;
    if(!price) {
        price = data.lastRoundResult?.result;
    }
    invariant(price);
    return price;
  }

  async computeLpPrice(lpTokId: TokenID, poolConfig: PoolConfig, connection: Connection): Promise<number> {
    invariant(poolConfig.isLp());
    invariant(poolConfig.tokenId === lpTokId);
    const lpMint = poolConfig.mint;
    const [leftTokId, rightTokId] = poolConfig.lpLeftRightTokenId!;
    invariant(lpMint);
    invariant(leftTokId);
    invariant(rightTokId);
    invariant(lpTokId in LP_SWAP_INFO);
    const [leftVault, rightVault] = LP_SWAP_INFO[lpTokId]?.getLRVaults()!;
    const leftBalance = (await connection.getTokenAccountBalance(leftVault)).value.uiAmount!;
    const rightBalance = (await connection.getTokenAccountBalance(rightVault)).value.uiAmount!;
    const lpMintData = (await connection.getParsedAccountInfo(lpMint)).value?.data as any;
    const lpBalanceStr = lpMintData.parsed?.info.supply;
    const decimalMult = DECIMAL_MULT[lpTokId];
    const lpBalance = new Decimal(lpBalanceStr).div(decimalMult).toNumber();

    const leftPrice = await this.fetchPrice(leftTokId, connection);
    const rightPrice = await this.fetchPrice(rightTokId, connection);

    return (leftPrice * leftBalance + rightPrice * rightBalance) / lpBalance;
  }

  async fetchLRStats(lpTokId: TokenID, connection: Connection, isValue: boolean): Promise<[number, number]> {
    const poolConfig = this.config.poolConfigs[lpTokId]!;
    invariant(poolConfig.isLp());
    const [leftTokId, rightTokId] = poolConfig.lpLeftRightTokenId!;
    invariant(leftTokId);
    invariant(rightTokId);
    const [leftVault, rightVault] = LP_SWAP_INFO[lpTokId]?.getLRVaults()!;
    const leftBalance = (await connection.getTokenAccountBalance(leftVault)).value.uiAmount!;
    const rightBalance = (await connection.getTokenAccountBalance(rightVault)).value.uiAmount!;
    if (!isValue) {
      return [leftBalance, rightBalance];
    }
    const leftPrice = await this.fetchPrice(leftTokId, connection);
    const rightPrice = await this.fetchPrice(rightTokId, connection);
    return [leftBalance * leftPrice, rightBalance * rightPrice];
  }

  async fetchLRAmounts(lpTokId: TokenID, connection: Connection): Promise<[number, number]> {
    return this.fetchLRStats(lpTokId, connection, false);
  }

  async fetchLRValuets(lpTokId: TokenID, connection: Connection): Promise<[number, number]> {
    return this.fetchLRStats(lpTokId, connection, true);
  }
}