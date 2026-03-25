import Lake
open Lake DSL

package «seeker-iou-proofs» where
  leanOptions := #[
    ⟨`autoImplicit, false⟩
  ]

@[default_target]
lean_lib «Proofs» where
  srcDir := "."

lean_lib «QEDGen» where
  srcDir := "."
