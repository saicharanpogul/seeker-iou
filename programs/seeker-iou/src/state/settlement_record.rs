use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct SettlementRecord {
    pub vault: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub nonce: u64,
    pub settled_at: i64,
    pub settled_by: Pubkey,
    pub success: bool,
    pub bump: u8,
}
