use quasar_lang::prelude::*;

/// IOU message layout — 217 bytes, read zero-copy from instruction data.
/// Must match the Borsh serialization order used by the TypeScript SDK.
#[repr(C)]
#[derive(Clone, Copy)]
pub struct IOUMessage {
    pub version: u8,
    pub vault: [u8; 32],
    pub sender: [u8; 32],
    pub recipient: [u8; 32],
    pub token_mint: [u8; 32],
    pub amount: [u8; 8],   // u64 LE
    pub nonce: [u8; 8],    // u64 LE
    pub expiry: [u8; 8],   // i64 LE
    pub sgt_mint: [u8; 32],
    pub memo: [u8; 32],
}

impl IOUMessage {
    pub const SIZE: usize = 217;

    pub fn from_bytes(data: &[u8]) -> Option<&Self> {
        if data.len() != Self::SIZE {
            return None;
        }
        // SAFETY: IOUMessage is repr(C) with alignment 1, all fields are byte arrays
        Some(unsafe { &*(data.as_ptr() as *const Self) })
    }

    pub fn amount_u64(&self) -> u64 {
        u64::from_le_bytes(self.amount)
    }

    pub fn nonce_u64(&self) -> u64 {
        u64::from_le_bytes(self.nonce)
    }

    pub fn expiry_i64(&self) -> i64 {
        i64::from_le_bytes(self.expiry)
    }

    pub fn vault_address(&self) -> &Address {
        unsafe { &*(self.vault.as_ptr() as *const Address) }
    }

    pub fn sender_address(&self) -> &Address {
        unsafe { &*(self.sender.as_ptr() as *const Address) }
    }

    pub fn recipient_address(&self) -> &Address {
        unsafe { &*(self.recipient.as_ptr() as *const Address) }
    }

    pub fn token_mint_address(&self) -> &Address {
        unsafe { &*(self.token_mint.as_ptr() as *const Address) }
    }

    pub fn sgt_mint_address(&self) -> &Address {
        unsafe { &*(self.sgt_mint.as_ptr() as *const Address) }
    }
}
