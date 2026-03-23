use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq)]
pub struct IOUMessage {
    pub version: u8,
    pub vault: Pubkey,
    pub sender: Pubkey,
    pub recipient: Pubkey,
    pub token_mint: Pubkey,
    pub amount: u64,
    pub nonce: u64,
    pub expiry: i64,
    pub sgt_mint: Pubkey,
    pub memo: [u8; 32],
}

impl IOUMessage {
    pub const SIZE: usize = 1 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 32 + 32; // 217 bytes
}
