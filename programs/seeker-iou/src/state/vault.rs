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
    /// Reserve ratio in basis points (0-10000). E.g. 3000 = 30% reserve.
    /// Only (100% - reserve%) of remaining balance is available for IOUs.
    /// The reserved portion acts as a bond — slashed on failed settlements
    /// to partially compensate cheated recipients.
    pub reserve_ratio_bps: u16,
    /// Cumulative amount slashed from the bond for failed settlements.
    pub total_slashed: u64,
    pub bump: u8,
}

impl Vault {
    /// Remaining balance in the vault (deposited - spent)
    pub fn remaining_balance(&self) -> u64 {
        self.deposited_amount.saturating_sub(self.spent_amount)
    }

    /// Amount reserved as bond (not available for IOUs)
    pub fn bond_amount(&self) -> u64 {
        let remaining = self.remaining_balance();
        (remaining as u128 * self.reserve_ratio_bps as u128 / 10000) as u64
    }

    /// Balance available for IOU settlements (remaining minus bond)
    pub fn available_for_ious(&self) -> u64 {
        self.remaining_balance().saturating_sub(self.bond_amount())
    }
}
