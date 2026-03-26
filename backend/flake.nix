{
  description = "flake-description";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";

    flake-utils.url = "github:numtide/flake-utils";

    devshell = {
      url = "github:numtide/devshell";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    pyproject-nix = {
      url = "github:pyproject-nix/pyproject.nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    uv2nix = {
      url = "github:pyproject-nix/uv2nix";
      inputs.nixpkgs.follows = "nixpkgs";
      inputs.pyproject-nix.follows = "pyproject-nix";
    };

    pyproject-build-systems = {
      url = "github:pyproject-nix/build-system-pkgs";
      inputs.nixpkgs.follows = "nixpkgs";
      inputs.pyproject-nix.follows = "pyproject-nix";
      inputs.uv2nix.follows = "uv2nix";
    };
  };

  outputs =
    inputs@{ nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        python = pkgs.python311;

        workspaceRoot = ./.;
        venvName = ".venv";

        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfree = false;
        };

        workspace = inputs.uv2nix.lib.workspace.loadWorkspace { inherit workspaceRoot; };

        overlay = workspace.mkPyprojectOverlay { sourcePreference = "wheel"; };

        baseSet = pkgs.callPackage inputs.pyproject-nix.build.packages { inherit python; };

        pythonSet = baseSet.overrideScope (
          pkgs.lib.composeManyExtensions [
            inputs.pyproject-build-systems.overlays.default
            overlay
            (final: prev: {
              "alive-progress" = prev."alive-progress".overrideAttrs (old: {
                postInstall = (old.postInstall or "") + "\nrm -f $out/LICENSE";
              });
              "about-time" = prev."about-time".overrideAttrs (old: {
                postInstall = (old.postInstall or "") + "\nrm -f $out/LICENSE";
              });
              numba = prev.numba.overrideAttrs (old: {
                nativeBuildInputs = (old.nativeBuildInputs or []) ++ [ pkgs.autoPatchelfHook ];
                autoPatchelfIgnoreMissingDeps = [ "libtbb.so.12" ];
              });
            })
          ]
        );

        venv = pythonSet.mkVirtualEnv "${venvName}" workspace.deps.default;
      in
      {
        devShells.default = pkgs.mkShell {
          packages = [
            venv
            python
            pkgs.uv
            pkgs.ty
            pkgs.ruff
            pkgs.tbb
          ];
        };
      }
    );
}
