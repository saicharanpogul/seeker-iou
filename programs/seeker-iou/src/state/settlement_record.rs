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
    /// Amount slashed from the vault bond to partially compensate the recipient
    /// on a failed settlement. Zero if settlement succeeded or no bond exists.
    pub slash_amount: u64,
    pub bump: u8,
}
