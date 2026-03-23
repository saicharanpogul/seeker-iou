use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct ReputationAccount {
    pub sgt_mint: Pubkey,
    pub total_issued: u64,
    pub total_settled: u64,
    pub total_failed: u64,
    pub total_volume: u64,
    pub last_failure_at: i64,
    pub created_at: i64,
    pub bump: u8,
}
