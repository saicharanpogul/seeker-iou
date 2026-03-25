import Lake
open Lake DSL

package «seeker-iou-proofs» where
  leanOptions := #[
    ⟨`autoImplicit, false⟩
  ]
  moreLinkArgs := #["-L./.lake/packages/mathlib/.lake/build/lib", "-lMathlib"]

require mathlib from git
  "https://github.com/leanprover-community/mathlib4" @ "v4.15.0"

@[default_target]
lean_lib «Proofs» where
  srcDir := "."

lean_lib «QEDGen» where
  srcDir := "."
