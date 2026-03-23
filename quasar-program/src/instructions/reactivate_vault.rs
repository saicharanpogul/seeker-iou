use quasar_lang::prelude::*;
use quasar_spl::{InterfaceAccount, Mint};

use crate::errors::SeekerIOUError;
use crate::events::VaultReactivated;
use crate::state::Vault;

#[derive(Accounts)]
pub struct ReactivateVault<'info> {
    pub owner: &'info Signer,

    #[account(
        mut,
        seeds = [b"vault", owner, token_mint],
        bump = vault.bump,
        has_one = owner,
        has_one = token_mint,
        constraint = !vault.is_active.get() @ SeekerIOUError::VaultStillActive,
    )]
    pub vault: &'info mut Account<Vault>,

    pub token_mint: &'info InterfaceAccount<Mint>,
}

impl<'info> ReactivateVault<'info> {
    #[inline(always)]
    pub fn reactivate(&mut self) -> Result<(), ProgramError> {
        self.vault.is_active = true.into();
        self.vault.deactivated_at = 0i64.into();

        emit!(VaultReactivated {
            vault: *self.vault.address(),
            owner: *self.owner.address(),
        });

        Ok(())
    }
}
