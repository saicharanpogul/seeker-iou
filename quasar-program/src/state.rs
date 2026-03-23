use quasar_lang::prelude::*;

#[account(discriminator = 1)]
pub struct Vault {
    pub owner: Address,
    pub token_mint: Address,
    pub token_account: Address,
    pub deposited_amount: u64,
    pub spent_amount: u64,
    pub current_nonce: u64,
    pub sgt_mint: Address,
    pub created_at: i64,
    pub is_active: bool,
    pub deactivated_at: i64,
    pub cooldown_seconds: u32,
    pub reserve_ratio_bps: u16,
    pub total_slashed: u64,
    pub bump: u8,
}

#[account(discriminator = 2)]
pub struct SettlementRecord {
    pub vault: Address,
    pub recipient: Address,
    pub amount: u64,
    pub nonce: u64,
    pub settled_at: i64,
    pub settled_by: Address,
    pub success: bool,
    pub slash_amount: u64,
    pub bump: u8,
}

#[account(discriminator = 3)]
pub struct ReputationAccount {
    pub sgt_mint: Address,
    pub total_issued: u64,
    pub total_settled: u64,
    pub total_failed: u64,
    pub total_volume: u64,
    pub last_failure_at: i64,
    pub created_at: i64,
    pub bump: u8,
}
