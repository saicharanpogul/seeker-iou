import QEDGen

open QEDGen.Solana

/-- Vault state matching the on-chain Vault account --/
structure VaultState where
  owner           : Pubkey
  deposited_amount : U64
  spent_amount    : U64
  current_nonce   : U64
  is_active       : Bool
  deactivated_at  : Nat
  cooldown_seconds : Nat
  reserve_ratio_bps : Nat  -- 0..10000
  total_slashed   : U64

/-- Remaining balance in the vault --/
def VaultState.remaining (s : VaultState) : Nat :=
  s.deposited_amount - s.spent_amount

/-- Bond amount (reserved portion) --/
def VaultState.bond (s : VaultState) : Nat :=
  s.remaining * s.reserve_ratio_bps / 10000

/-- Balance available for IOU settlements --/
def VaultState.available (s : VaultState) : Nat :=
  s.remaining - s.bond

/-- Reputation state --/
structure ReputationState where
  total_issued  : U64
  total_settled : U64
  total_failed  : U64
  total_volume  : U64

/-- Conservation invariant: deposited >= spent --/
def conservation (s : VaultState) : Prop :=
  s.deposited_amount >= s.spent_amount
