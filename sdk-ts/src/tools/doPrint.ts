import { ALPHA_CONFIG, PUBLIC_CONFIG } from "../constants";
import { Addresses } from "../addresses";
import invariant from "tiny-invariant";
import { Dex, OrcaLpSwapInfo, SaberLpSwapInfo } from "..";

const [,,production] = process.argv;
invariant(['alpha', 'public'].includes(production))


async function printAddresses() {
  const config = production === 'alpha' ? ALPHA_CONFIG : PUBLIC_CONFIG;
  const consts = new Addresses(config);
  const [base_pda, bbump] = await consts.getBasePda();
  const [price_pda, pbump] = await consts.getPricePda();
  console.log(`PROGRAM : ${config.programPubkey.toString()}`);
  console.log(`ADMIN   : ${config.adminPubkey.toString()}`);
  console.log(`BASE_PDA  : ${base_pda.toString()}, bump=${bbump}`);
  console.log(`PRICE_PDA : ${price_pda.toString()}, bump=${pbump}`);
  console.log(`user_pages_stats: ${(await consts.getUserPagesStatsKey()).toString()}`);
  console.log(`pool_summaries  : ${(await consts.getPoolSummariesKey()).toString()}`);
  console.log(`Price_summaries : ${(await consts.getPriceSummariesKey(base_pda)).toString()}`);

  console.log(config.poolConfigs);

  console.log(`\nPrint saber farm keys:\n`);
  for (const poolCfg of Object.values(config.poolConfigs)) {
    if (poolCfg.isLp() === true && poolCfg.lpDex === Dex.Saber) {
      console.log(`LP ${poolCfg.tokenId}:`);
      const saberLpSwapInfo = poolCfg.lpSwapKeyInfo as SaberLpSwapInfo;
      const [owner] = await consts.getBasePda();
      const [minerKey] = await saberLpSwapInfo.getMinerKey(owner);
      const minerVault = await saberLpSwapInfo.getMinerVault(owner);
      console.log(`minerKey: ${minerKey.toBase58()}`);
      console.log(`minerVault: ${minerVault.toBase58()}`);
      console.log('\n');
    }
  }

  console.log(`\nPrint orca farm keys:\n`);
  for (const poolCfg of Object.values(config.poolConfigs)) {
    if (poolCfg.isLp() === true && poolCfg.lpDex === Dex.Orca) {
      console.log(`LP ${poolCfg.tokenId}:`);
      const orcaLpSwapInfo = poolCfg.lpSwapKeyInfo as OrcaLpSwapInfo;
      const pdaKeys = await orcaLpSwapInfo.getPdaKeys(base_pda);
      for (const [key, value] of Object.entries(pdaKeys)) {
        console.log(`${key}: ${value.toBase58()}`);
      }
      if (poolCfg.lpNeedSndStake) {
        const stakeTableKey = await consts.getAssetPoolStakeTableKey(poolCfg.mint.toString());
        const ddKeys = await orcaLpSwapInfo.getPdaDoubleDipKeys(base_pda);
        console.log(`StakeTable: ${stakeTableKey.toString()}`);
        console.log(`DD userFarmState: ${ddKeys.pdaDoubleDipFarmState.toString()}`);
        console.log(`DD rewardTokAcc: ${ddKeys.pdaDoubleDipRewardTokenAccount.toString()}`);
        console.log(`DD LP3 token account: ${ddKeys.pdaDoubleDipFarmTokenAccount.toString()}`);
      }
      console.log('\n');
    }
  }
}

printAddresses();
