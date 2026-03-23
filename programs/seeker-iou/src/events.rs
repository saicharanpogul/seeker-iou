use anchor_lang::prelude::*;

#[event]
pub struct VaultCreated {
    pub owner: Pubkey,
    pub token_mint: Pubkey,
    pub vault: Pubkey,
    pub sgt_mint: Pubkey,
}

#[event]
pub struct Deposited {
    pub vault: Pubkey,
    pub amount: u64,
    pub new_total: u64,
}

#[event]
pub struct IOUSettled {
    pub vault: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub nonce: u64,
    pub settler: Pubkey,
}

#[event]
pub struct IOUFailed {
    pub vault: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub nonce: u64,
    pub settler: Pubkey,
    pub reason: String,
}

#[event]
pub struct VaultDeactivated {
    pub vault: Pubkey,
    pub owner: Pubkey,
}

#[event]
pub struct VaultReactivated {
    pub vault: Pubkey,
    pub owner: Pubkey,
}

#[event]
pub struct VaultWithdrawn {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
}
