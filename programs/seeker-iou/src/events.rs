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
    /// Amount slashed from bond and transferred to recipient as partial compensation
    pub slash_amount: u64,
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

#[event]
pub struct ReserveRatioUpdated {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub old_ratio_bps: u16,
    pub new_ratio_bps: u16,
}

#[event]
pub struct CooldownUpdated {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub old_cooldown: u32,
    pub new_cooldown: u32,
}
