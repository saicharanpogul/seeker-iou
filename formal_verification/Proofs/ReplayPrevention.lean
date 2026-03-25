import Proofs.State
import Mathlib.Tactic

open QEDGen.Solana

-- P4: Nonce strictly increases after settlement
def settleTransition (s : VaultState) (nonce : Nat) (amount : Nat) : Option VaultState :=
  if s.is_active = true
    ∧ nonce > s.current_nonce
    ∧ amount > 0
  then some { s with current_nonce := nonce }
  else none

theorem nonce_strictly_increases (s s' : VaultState) (nonce amount : Nat)
    (h : settleTransition s nonce amount = some s') :
    s'.current_nonce > s.current_nonce := by
  unfold settleTransition at h; split_ifs at h with h_cond
  · obtain rfl := Option.some.inj h; exact h_cond.2.1

-- P12: No settlement when vault is inactive
theorem no_settle_when_inactive (s : VaultState) (nonce amount : Nat)
    (h_inactive : s.is_active = false) :
    settleTransition s nonce amount = none := by
  unfold settleTransition; simp [h_inactive]
