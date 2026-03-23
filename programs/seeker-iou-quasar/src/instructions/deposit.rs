use quasar_lang::prelude::*;
use quasar_spl::{InterfaceAccount, Mint, Token, TokenCpi, TokenInterface};

use crate::errors::SeekerIOUError;
use crate::events::Deposited;
use crate::state::Vault;

#[derive(Accounts)]
pub struct Deposit<'info> {
    pub owner: &'info mut Signer,

    #[account(
        mut,
        seeds = [b"vault", owner, token_mint],
        bump = vault.bump,
        has_one = owner,
        has_one = token_mint,
        constraint = vault.is_active.get() @ SeekerIOUError::VaultNotActive,
    )]
    pub vault: &'info mut Account<Vault>,

    pub token_mint: &'info InterfaceAccount<Mint>,

    #[account(mut, associated_token::mint = token_mint, associated_token::authority = owner)]
    pub owner_token_account: &'info mut InterfaceAccount<Token>,

    #[account(mut, address = vault.token_account)]
    pub vault_token_account: &'info mut InterfaceAccount<Token>,

    pub token_program: &'info Interface<TokenInterface>,
}

impl<'info> Deposit<'info> {
    #[inline(always)]
    pub fn deposit(&mut self, amount: u64) -> Result<(), ProgramError> {
        require!(amount > 0, SeekerIOUError::InvalidDepositAmount);

        self.token_program
            .transfer_checked(
                self.owner_token_account,
                self.token_mint,
                self.vault_token_account,
                self.owner,
                amount,
                self.token_mint.decimals(),
            )
            .invoke()?;

        self.vault.deposited_amount = self
            .vault
            .deposited_amount
            .get()
            .checked_add(amount)
            .ok_or(ProgramError::from(SeekerIOUError::ArithmeticOverflow))?;

        emit!(Deposited {
            vault: *self.vault.address(),
            amount,
            new_total: self.vault.deposited_amount.get(),
        });

        Ok(())
    }
}
