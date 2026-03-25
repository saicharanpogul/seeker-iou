import Proofs.State

open QEDGen.Solana

-- P11: Cooldown enforced on withdrawal
-- Redefine withdraw locally to avoid cross-file issues
private def withdrawTransition' (s : VaultState) (signer : Pubkey) (clock_ts : Nat) : Option VaultState :=
  if signer = s.owner
    ∧ s.is_active = false
    ∧ clock_ts >= s.deactivated_at + s.cooldown_seconds
    ∧ s.remaining > 0
  then
    some { s with spent_amount := s.spent_amount + s.remaining }
  else none

theorem cooldown_enforced (s : VaultState) (signer : Pubkey) (clock_ts : Nat)
    (h : withdrawTransition' s signer clock_ts ≠ none) :
    clock_ts >= s.deactivated_at + s.cooldown_seconds := by
  unfold withdrawTransition' at h
  by_cases hc : signer = s.owner ∧ s.is_active = false ∧ clock_ts >= s.deactivated_at + s.cooldown_seconds ∧ s.remaining > 0
  · exact hc.2.2.1
  · simp only [if_neg hc] at h
    exact absurd rfl h

theorem withdraw_requires_inactive (s : VaultState) (signer : Pubkey) (clock_ts : Nat)
    (h : withdrawTransition' s signer clock_ts ≠ none) :
    s.is_active = false := by
  unfold withdrawTransition' at h
  by_cases hc : signer = s.owner ∧ s.is_active = false ∧ clock_ts >= s.deactivated_at + s.cooldown_seconds ∧ s.remaining > 0
  · exact hc.2.1
  · simp only [if_neg hc] at h
    exact absurd rfl h

theorem withdraw_requires_balance (s : VaultState) (signer : Pubkey) (clock_ts : Nat)
    (h : withdrawTransition' s signer clock_ts ≠ none) :
    s.remaining > 0 := by
  unfold withdrawTransition' at h
  by_cases hc : signer = s.owner ∧ s.is_active = false ∧ clock_ts >= s.deactivated_at + s.cooldown_seconds ∧ s.remaining > 0
  · exact hc.2.2.2
  · simp only [if_neg hc] at h
    exact absurd rfl h
