use quasar_lang::prelude::*;
use quasar_spl::{AssociatedToken, AssociatedTokenProgram, InterfaceAccount, Mint, Token, TokenInterface};

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

        self.vault.owner = *self.owner.address();
        self.vault.token_mint = *self.token_mint.address();
        self.vault.token_account = *self.vault_token_account.address();
        self.vault.deposited_amount = 0;
        self.vault.spent_amount = 0;
        self.vault.current_nonce = 0;
        self.vault.sgt_mint = *self.sgt_mint.address();
        self.vault.created_at = clock.unix_timestamp;
        self.vault.is_active = true;
        self.vault.deactivated_at = 0;
        self.vault.cooldown_seconds = cooldown;
        self.vault.reserve_ratio_bps = reserve_ratio_bps;
        self.vault.total_slashed = 0;
        self.vault.bump = bumps.vault;

        // Init reputation if new
        if self.reputation.created_at.get() == 0 {
            self.reputation.sgt_mint = *self.sgt_mint.address();
            self.reputation.total_issued = 0;
            self.reputation.total_settled = 0;
            self.reputation.total_failed = 0;
            self.reputation.total_volume = 0;
            self.reputation.last_failure_at = 0;
            self.reputation.created_at = clock.unix_timestamp;
            self.reputation.bump = bumps.reputation;
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
