use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Vault {
    pub owner: Pubkey,
    pub token_mint: Pubkey,
    pub token_account: Pubkey,
    pub deposited_amount: u64,
    pub spent_amount: u64,
    pub current_nonce: u64,
    pub sgt_mint: Pubkey,
    pub created_at: i64,
    pub is_active: bool,
    pub deactivated_at: i64,
    pub cooldown_seconds: u32,
    pub bump: u8,
}
