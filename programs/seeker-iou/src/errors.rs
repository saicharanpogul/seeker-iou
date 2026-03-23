use anchor_lang::prelude::*;

#[error_code]
pub enum SeekerIOUError {
    #[msg("Invalid SGT mint authority")]
    InvalidSgtMintAuthority,
    #[msg("SGT token account does not belong to the owner")]
    InvalidSgtOwner,
    #[msg("SGT token account has zero balance")]
    InvalidSgtBalance,
    #[msg("Vault is not active")]
    VaultNotActive,
    #[msg("Vault is still active")]
    VaultStillActive,
    #[msg("Deposit amount must be greater than zero")]
    InvalidDepositAmount,
    #[msg("Invalid IOU message version")]
    InvalidIOUVersion,
    #[msg("IOU vault does not match")]
    IOUVaultMismatch,
    #[msg("IOU sender does not match vault owner")]
    IOUSenderMismatch,
    #[msg("IOU recipient does not match")]
    IOURecipientMismatch,
    #[msg("IOU token mint does not match vault")]
    IOUTokenMintMismatch,
    #[msg("IOU SGT mint does not match vault")]
    IOUSgtMintMismatch,
    #[msg("IOU nonce must be greater than vault current nonce")]
    InvalidNonce,
    #[msg("IOU nonce does not match the provided nonce argument")]
    NonceMismatch,
    #[msg("IOU has expired")]
    IOUExpired,
    #[msg("IOU amount must be greater than zero")]
    InvalidIOUAmount,
    #[msg("Insufficient vault balance")]
    InsufficientBalance,
    #[msg("Ed25519 signature verification failed")]
    InvalidSignature,
    #[msg("Ed25519 instruction not found")]
    MissingEd25519Instruction,
    #[msg("Invalid Ed25519 instruction data")]
    InvalidEd25519InstructionData,
    #[msg("Cooldown period has not elapsed")]
    CooldownNotElapsed,
    #[msg("No balance to withdraw")]
    NoBalanceToWithdraw,
    #[msg("Invalid IOU message data")]
    InvalidIOUMessage,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
}
