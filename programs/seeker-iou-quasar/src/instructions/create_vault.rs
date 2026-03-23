use quasar_lang::prelude::*;
use quasar_lang::sysvars::Sysvar as SysvarTrait;
use quasar_spl::{AssociatedTokenProgram, InterfaceAccount, Mint, Token, TokenInterface};

use crate::errors::SeekerIOUError;
use crate::events::VaultCreated;
use crate::state::{ReputationAccount, Vault};

pub const SGT_MINT_AUTHORITY: Address = address!("GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4");
pub const DEFAULT_COOLDOWN_SECONDS: u32 = 3600;
pub const MIN_COOLDOWN_SECONDS: u32 = 300;
pub const MAX_RESERVE_RATIO_BPS: u16 = 10000;

#[derive(Accounts)]
pub struct CreateVault<'info> {
    pub owner: &'info mut Signer,

    #[account(init, payer = owner, seeds = [b"vault", owner, token_mint], bump)]
    pub vault: &'info mut Account<Vault>,

    pub token_mint: &'info InterfaceAccount<Mint>,

    #[account(init, associated_token::mint = token_mint, associated_token::authority = vault)]
    pub vault_token_account: &'info mut InterfaceAccount<Token>,

    #[account(
        constraint = sgt_token_account.owner() == owner.address() @ SeekerIOUError::InvalidSgtOwner,
        constraint = sgt_token_account.amount() > 0 @ SeekerIOUError::InvalidSgtBalance,
    )]
    pub sgt_token_account: &'info InterfaceAccount<Token>,

    #[account(
        constraint = sgt_mint.mint_authority() == Some(&SGT_MINT_AUTHORITY) @ SeekerIOUError::InvalidSgtMintAuthority,
    )]
    pub sgt_mint: &'info InterfaceAccount<Mint>,

    #[account(init_if_needed, payer = owner, seeds = [b"reputation", sgt_mint], bump)]
    pub reputation: &'info mut Account<ReputationAccount>,

    pub system_program: &'info Program<System>,
    pub token_program: &'info Interface<TokenInterface>,
    pub ata_program: &'info Program<AssociatedTokenProgram>,
}

impl<'info> CreateVault<'info> {
    #[inline(always)]
    pub fn create_vault(
        &mut self,
        reserve_ratio_bps: u16,
        cooldown_seconds: u32,
        bumps: &CreateVaultBumps,
    ) -> Result<(), ProgramError> {
        require!(
            reserve_ratio_bps <= MAX_RESERVE_RATIO_BPS,
            SeekerIOUError::InvalidReserveRatio
        );

        let cooldown = if cooldown_seconds == 0 {
            DEFAULT_COOLDOWN_SECONDS
        } else {
            require!(
                cooldown_seconds >= MIN_COOLDOWN_SECONDS,
                SeekerIOUError::CooldownTooShort
            );
            cooldown_seconds
        };

        let clock = Clock::get()?;

        self.vault.set_inner(
            *self.owner.address(),           // owner
            *self.token_mint.address(),      // token_mint
            *self.vault_token_account.address(), // token_account
            0u64,                            // deposited_amount
            0u64,                            // spent_amount
            0u64,                            // current_nonce
            *self.sgt_mint.address(),        // sgt_mint
            clock.unix_timestamp.get(),      // created_at
            true,                            // is_active
            0i64,                            // deactivated_at
            cooldown,                        // cooldown_seconds
            reserve_ratio_bps,               // reserve_ratio_bps
            0u64,                            // total_slashed
            bumps.vault,                     // bump
        );

        // Init reputation if new
        if self.reputation.created_at.get() == 0 {
            self.reputation.set_inner(
                *self.sgt_mint.address(),    // sgt_mint
                0u64,                        // total_issued
                0u64,                        // total_settled
                0u64,                        // total_failed
                0u64,                        // total_volume
                0i64,                        // last_failure_at
                clock.unix_timestamp.get(),  // created_at
                bumps.reputation,            // bump
            );
        }

        emit!(VaultCreated {
            owner: *self.owner.address(),
            token_mint: *self.token_mint.address(),
            vault: *self.vault.address(),
            sgt_mint: *self.sgt_mint.address(),
        });

        Ok(())
    }
}
