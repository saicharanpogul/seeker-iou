use quasar_lang::prelude::*;

use crate::errors::SeekerIOUError;
use crate::events::ReserveRatioUpdated;
use crate::instructions::create_vault::MAX_RESERVE_RATIO_BPS;
use crate::state::Vault;

#[derive(Accounts)]
pub struct SetReserveRatio<'info> {
    pub owner: &'info Signer,

    #[account(
        mut,
        seeds = [b"vault", owner, vault.token_mint],
        bump = vault.bump,
        has_one = owner,
        constraint = vault.is_active.get() @ SeekerIOUError::VaultNotActive,
    )]
    pub vault: &'info mut Account<Vault>,
}

impl<'info> SetReserveRatio<'info> {
    #[inline(always)]
    pub fn set_reserve_ratio(&mut self, reserve_ratio_bps: u16) -> Result<(), ProgramError> {
        require!(
            reserve_ratio_bps <= MAX_RESERVE_RATIO_BPS,
            SeekerIOUError::InvalidReserveRatio
        );

        let old_ratio = self.vault.reserve_ratio_bps.get();
        self.vault.reserve_ratio_bps = reserve_ratio_bps;

        emit!(ReserveRatioUpdated {
            vault: *self.vault.address(),
            owner: *self.owner.address(),
            old_ratio_bps: old_ratio,
            new_ratio_bps: reserve_ratio_bps,
        });

        Ok(())
    }
}
