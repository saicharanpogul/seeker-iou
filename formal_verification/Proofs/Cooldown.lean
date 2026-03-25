import Proofs.State
import Mathlib.Tactic

open QEDGen.Solana

-- Redefine withdraw locally to keep proofs self-contained
private def withdrawTransition' (s : VaultState) (signer : Pubkey) (clock_ts : Nat) : Option VaultState :=
  if signer = s.owner
    ∧ s.is_active = false
    ∧ clock_ts >= s.deactivated_at + s.cooldown_seconds
    ∧ s.remaining > 0
  then
    some { s with spent_amount := s.spent_amount + s.remaining }
  else none

-- P11: Cooldown enforced on withdrawal
theorem cooldown_enforced (s : VaultState) (signer : Pubkey) (clock_ts : Nat)
    (h : withdrawTransition' s signer clock_ts ≠ none) :
    clock_ts >= s.deactivated_at + s.cooldown_seconds := by
  unfold withdrawTransition' at h
  split_ifs at h with h_cond
  · exact h_cond.2.2.1
  · contradiction

theorem withdraw_requires_inactive (s : VaultState) (signer : Pubkey) (clock_ts : Nat)
    (h : withdrawTransition' s signer clock_ts ≠ none) :
    s.is_active = false := by
  unfold withdrawTransition' at h
  split_ifs at h with h_cond
  · exact h_cond.2.1
  · contradiction

theorem withdraw_requires_balance (s : VaultState) (signer : Pubkey) (clock_ts : Nat)
    (h : withdrawTransition' s signer clock_ts ≠ none) :
    s.remaining > 0 := by
  unfold withdrawTransition' at h
  split_ifs at h with h_cond
  · exact h_cond.2.2.2
  · contradiction
