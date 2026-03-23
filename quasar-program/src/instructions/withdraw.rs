use quasar_lang::prelude::*;
use quasar_lang::sysvars::Sysvar as SysvarTrait;
use quasar_spl::{InterfaceAccount, Mint, Token, TokenCpi, TokenInterface};

use crate::errors::SeekerIOUError;
use crate::events::VaultWithdrawn;
use crate::state::Vault;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    pub owner: &'info mut Signer,

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

    #[account(mut, address = vault.token_account)]
    pub vault_token_account: &'info mut InterfaceAccount<Token>,

    #[account(mut, associated_token::mint = token_mint, associated_token::authority = owner)]
    pub owner_token_account: &'info mut InterfaceAccount<Token>,

    pub token_program: &'info Interface<TokenInterface>,
}

impl<'info> Withdraw<'info> {
    #[inline(always)]
    pub fn withdraw(&mut self, bumps: &WithdrawBumps) -> Result<(), ProgramError> {
        let clock = Clock::get()?;

        let cooldown_end = self
            .vault
            .deactivated_at
            .get()
            .checked_add(self.vault.cooldown_seconds.get() as i64)
            .ok_or(ProgramError::from(SeekerIOUError::ArithmeticOverflow))?;
        require!(
            clock.unix_timestamp.get() >= cooldown_end,
            SeekerIOUError::CooldownNotElapsed
        );

        let book_remaining = self
            .vault
            .deposited_amount
            .get()
            .checked_sub(self.vault.spent_amount.get())
            .ok_or(ProgramError::from(SeekerIOUError::ArithmeticOverflow))?;
        let actual_balance = self.vault_token_account.amount();
        let remaining = book_remaining.min(actual_balance);
        require!(remaining > 0, SeekerIOUError::NoBalanceToWithdraw);

        let seeds = bumps.vault_seeds();
        self.token_program
            .transfer(
                self.vault_token_account,
                self.owner_token_account,
                self.vault,
                remaining,
            )
            .invoke_signed(&seeds)?;

        self.vault.spent_amount = self
            .vault
            .spent_amount
            .get()
            .checked_add(remaining)
            .ok_or(ProgramError::from(SeekerIOUError::ArithmeticOverflow))?
            .into();

        emit!(VaultWithdrawn {
            vault: *self.vault.address(),
            owner: *self.owner.address(),
            amount: remaining,
        });

        Ok(())
    }
}
