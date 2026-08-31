#!/usr/bin/env bash
# ==============================================================================
# skills-sync — Autonomous AI Agent Skills Cross-Repository Synchronization Tool
# Repository: https://github.com/MishraShardendu22/agent-skills
# Author: Shardendu Mishra (@MishraShardendu22)
# License: MIT
# ==============================================================================

set -eo pipefail

VERSION="1.0.0"
DEFAULT_REPO="MishraShardendu22/agent-skills"
DEFAULT_BRANCH="main"
REPO_URL="${AGENT_SKILLS_REPO:-$DEFAULT_REPO}"
BRANCH="${AGENT_SKILLS_BRANCH:-$DEFAULT_BRANCH}"

# Colors & Formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}ℹ${NC} $*"; }
log_success() { echo -e "${GREEN}✔${NC} $*"; }
log_warn() { echo -e "${YELLOW}▲${NC} $*"; }
log_error() { echo -e "${RED}✖${NC} $*" >&2; }

# Locate repository root and skills directory
find_skills_dir() {
    local dir="$PWD"
    while [[ "$dir" != "/" ]]; do
        if [[ -d "$dir/.agents/skills" ]]; then
            echo "$dir/.agents/skills"
            return 0
        elif [[ -d "$dir/skills" && ! -L "$dir/skills" ]]; then
            echo "$dir/skills"
            return 0
        fi
        if [[ -d "$dir/.git" ]]; then
            # Inside a git repo without skills directory yet: default to .agents/skills
            echo "$dir/.agents/skills"
            return 0
        fi
        dir="$(dirname "$dir")"
    done
    echo "$PWD/.agents/skills"
}

SKILLS_DIR="$(find_skills_dir)"

# Show Help
show_help() {
    cat <<EOF
${BOLD}skills-sync${NC} (v${VERSION}) — Cross-Repository Synchronization Engine for AI Agent Skills

${BOLD}USAGE:${NC}
    skills-sync <command> [options]

${BOLD}COMMANDS:${NC}
    ${CYAN}pull${NC}                  Fetch and update skills from upstream (${REPO_URL})
    ${CYAN}push [skill-name]${NC}     Push newly created or modified local skills back to upstream
    ${CYAN}sync${NC}                  Perform bidirectional sync (pull updates, then push new local skills)
    ${CYAN}new <skill-name>${NC}      Scaffold a new standardized SKILL.md template
    ${CYAN}list${NC}                  List all skills installed locally with their descriptions
    ${CYAN}validate${NC}              Lint and validate SKILL.md frontmatter across all skills
    ${CYAN}install${NC}               Install 'skills-sync' to ~/.local/bin for global CLI access
    ${CYAN}help, -h, --help${NC}      Show this help message
    ${CYAN}version, -v${NC}           Show version information

${BOLD}ENVIRONMENT VARIABLES:${NC}
    AGENT_SKILLS_REPO    Upstream repository (Default: ${DEFAULT_REPO})
    AGENT_SKILLS_BRANCH  Upstream branch (Default: ${DEFAULT_BRANCH})
    GITHUB_TOKEN         GitHub token for push/pull authentication (optional if gh is configured)

${BOLD}EXAMPLES:${NC}
    skills-sync pull
    skills-sync push git-commit-workflow
    skills-sync new database-auto-sync
    skills-sync sync
EOF
}

# Pull skills from upstream
cmd_pull() {
    log_info "Synchronizing skills from upstream: ${BOLD}${REPO_URL} (${BRANCH})${NC}"
    mkdir -p "$SKILLS_DIR"
    
    local tmp_dir
    tmp_dir="$(mktemp -d)"
    trap 'rm -rf "$tmp_dir"' EXIT

    local clone_url
    if git config --get remote.origin.url 2>/dev/null | grep -q "MishraShardendu22/agent-skills" && [[ "$PWD" == *"/agent-skills"* ]]; then
        log_info "Inside root agent-skills repository. Running git pull..."
        git pull origin "$BRANCH"
        log_success "Repository up to date."
        return 0
    fi

    if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
        clone_url="https://github.com/${REPO_URL}.git"
    else
        clone_url="https://github.com/${REPO_URL}.git"
    fi

    log_info "Fetching remote skill catalog..."
    if ! git clone --depth 1 --branch "$BRANCH" "$clone_url" "$tmp_dir/agent-skills" >/dev/null 2>&1; then
        log_error "Failed to clone upstream repository ${REPO_URL}. Check your internet connection or repository permissions."
        return 1
    fi

    local upstream_skills_dir="$tmp_dir/agent-skills/.agents/skills"
    if [[ ! -d "$upstream_skills_dir" ]]; then
        upstream_skills_dir="$tmp_dir/agent-skills/skills"
    fi

    if [[ ! -d "$upstream_skills_dir" ]]; then
        log_error "Upstream repository does not contain a valid skills folder."
        return 1
    fi

    local count=0
    for skill_path in "$upstream_skills_dir"/*; do
        if [[ -d "$skill_path" ]]; then
            local skill_name
            skill_name="$(basename "$skill_path")"
            if [[ "$skill_name" != .* ]]; then
                mkdir -p "$SKILLS_DIR/$skill_name"
                cp -r "$skill_path"/* "$SKILLS_DIR/$skill_name/"
                count=$((count + 1))
            fi
        fi
    done

    log_success "Successfully pulled and updated ${BOLD}${count}${NC} skills into ${BOLD}${SKILLS_DIR}${NC}"
}

# Push new or modified skills back to upstream
cmd_push() {
    local target_skill="$1"
    log_info "Preparing to push skills to upstream: ${BOLD}${REPO_URL} (${BRANCH})${NC}"

    if [[ ! -d "$SKILLS_DIR" ]]; then
        log_error "No local skills directory found at ${SKILLS_DIR}"
        return 1
    fi

    local tmp_dir
    tmp_dir="$(mktemp -d)"
    trap 'rm -rf "$tmp_dir"' EXIT

    local clone_url="git@github.com:${REPO_URL}.git"
    if ! git ls-remote "$clone_url" >/dev/null 2>&1; then
        clone_url="https://github.com/${REPO_URL}.git"
    fi

    log_info "Cloning upstream repository..."
    if ! git clone "$clone_url" "$tmp_dir/agent-skills" >/dev/null 2>&1; then
        log_warn "SSH clone failed or unauthorized, trying via gh/https..."
        if command -v gh >/dev/null 2>&1; then
            gh repo clone "$REPO_URL" "$tmp_dir/agent-skills" >/dev/null 2>&1 || {
                log_error "Failed to clone upstream repository. Please verify write permissions to ${REPO_URL}."
                return 1
            }
        else
            log_error "Unable to authenticate with ${REPO_URL}. Please ensure you have write permissions or GITHUB_TOKEN configured."
            return 1
        fi
    fi

    local upstream_skills_dir="$tmp_dir/agent-skills/.agents/skills"
    mkdir -p "$upstream_skills_dir"

    local pushed_count=0
    local changes=()

    if [[ -n "$target_skill" ]]; then
        if [[ ! -d "$SKILLS_DIR/$target_skill" ]]; then
            log_error "Skill '${target_skill}' not found in ${SKILLS_DIR}"
            return 1
        fi
        mkdir -p "$upstream_skills_dir/$target_skill"
        cp -r "$SKILLS_DIR/$target_skill"/* "$upstream_skills_dir/$target_skill/"
        changes+=("$target_skill")
        pushed_count=1
    else
        for skill_path in "$SKILLS_DIR"/*; do
            if [[ -d "$skill_path" ]]; then
                local s_name
                s_name="$(basename "$skill_path")"
                if [[ "$s_name" != .* ]]; then
                    mkdir -p "$upstream_skills_dir/$s_name"
                    cp -r "$skill_path"/* "$upstream_skills_dir/$s_name/"
                    changes+=("$s_name")
                    pushed_count=$((pushed_count + 1))
                fi
            fi
        done
    fi

    cd "$tmp_dir/agent-skills"
    if [[ -z "$(git status --porcelain)" ]]; then
        log_info "Upstream repository is already up to date with all local skills. No changes to push."
        return 0
    fi

    log_info "Staging changed skills..."
    git add .agents/skills/
    if [[ -L "skills" ]]; then git add skills; fi

    local commit_msg="feat(skills): sync ${pushed_count} skill(s) from downstream repository"
    if [[ -n "$target_skill" ]]; then
        commit_msg="feat(skill): add/update ${target_skill} skill"
    fi

    git -c user.name="AI Agent" -c user.email="agent@users.noreply.github.com" commit -m "$commit_msg"

    log_info "Pushing commit to ${REPO_URL}:${BRANCH}..."
    if git push origin "$BRANCH"; then
        log_success "Successfully pushed skill updates upstream to ${BOLD}${REPO_URL}${NC}!"
    else
        log_warn "Direct push failed. Attempting to create a sync feature branch and PR..."
        local sync_branch="sync-skills-$(date +%s)"
        git checkout -b "$sync_branch"
        git push origin "$sync_branch"
        if command -v gh >/dev/null 2>&1; then
            gh pr create --repo "$REPO_URL" --title "$commit_msg" --body "Automated skill sync from downstream project." --head "$sync_branch" --base "$BRANCH"
            log_success "Opened Pull Request on ${REPO_URL} targeting ${BRANCH}."
        else
            log_success "Pushed branch ${sync_branch} to ${REPO_URL}. Open a PR to merge."
        fi
    fi
}

# Bidirectional sync
cmd_sync() {
    log_info "${BOLD}Starting bidirectional skills synchronization...${NC}"
    cmd_pull
    cmd_push
    log_success "Bidirectional synchronization complete."
}

# Create a new skill
cmd_new() {
    local skill_name="$1"
    if [[ -z "$skill_name" ]]; then
        log_error "Please provide a skill name (e.g. skills-sync new my-awesome-skill)"
        return 1
    fi

    # Convert to kebab-case
    skill_name="$(echo "$skill_name" | tr '[:upper:]' '[:lower:]' | tr ' _' '--' | sed 's/[^a-z0-9-]//g')"
    local target="$SKILLS_DIR/$skill_name"

    if [[ -d "$target" ]]; then
        log_warn "Skill '${skill_name}' already exists at ${target}"
        return 0
    fi

    mkdir -p "$target"
    cat <<EOF > "$target/SKILL.md"
---
name: ${skill_name}
description: >-
  Standard operating procedure and workflow guidelines for ${skill_name}.
---

# ${skill_name^} Skill

This skill defines the official standards, runbooks, and automated procedures for ${skill_name}.

---

## 1. Overview

Describe the objective, scope, and target agents or environments for this skill.

---

## 2. Core Directives & Rules

> [!IMPORTANT]
> **CRITICAL DIRECTIVE**: Always follow the core requirements below before executing this workflow.

- Step 1: Initialize context and verify dependencies.
- Step 2: Perform execution with idempotent safeguards.
- Step 3: Run validation and log status.

---

## 3. Step-by-Step Procedure

\`\`\`bash
# Example execution command
\`\`\`
EOF

    log_success "Created new skill: ${BOLD}${target}/SKILL.md${NC}"
    log_info "Edit this file, then run ${BOLD}skills-sync push ${skill_name}${NC} to push it upstream."
}

# List all local skills
cmd_list() {
    if [[ ! -d "$SKILLS_DIR" ]]; then
        log_warn "No skills directory found at ${SKILLS_DIR}"
        return 0
    fi

    echo -e "\n${BOLD}Installed Skills in ${SKILLS_DIR}:${NC}\n"
    printf "  ${BOLD}%-32s %-50s${NC}\n" "SKILL NAME" "DESCRIPTION"
    printf "  %-32s %-50s\n" "--------------------------------" "--------------------------------------------------"

    local count=0
    for skill_path in "$SKILLS_DIR"/*; do
        if [[ -d "$skill_path" ]]; then
            local s_name
            s_name="$(basename "$skill_path")"
            if [[ "$s_name" != .* && -f "$skill_path/SKILL.md" ]]; then
                local desc
                desc="$(grep -A 3 '^description:' "$skill_path/SKILL.md" | tr '\n' ' ' | sed 's/description:[ >-]*//g' | sed 's/---.*//' | cut -c 1-50)"
                printf "  ${CYAN}%-32s${NC} %s...\n" "$s_name" "$desc"
                count=$((count + 1))
            fi
        fi
    done

    echo -e "\n${GREEN}Total: ${count} skills installed.${NC}\n"
}

# Validate skills
cmd_validate() {
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [[ -f "$script_dir/validate-skills.py" ]]; then
        python3 "$script_dir/validate-skills.py"
    else
        log_info "Running built-in basic validator..."
        local errors=0
        for skill_path in "$SKILLS_DIR"/*; do
            if [[ -d "$skill_path" ]]; then
                local s_name
                s_name="$(basename "$skill_path")"
                if [[ ! -f "$skill_path/SKILL.md" ]]; then
                    log_error "$s_name is missing SKILL.md"
                    errors=$((errors + 1))
                else
                    log_success "$s_name: SKILL.md OK"
                fi
            fi
        done
        if [[ $errors -gt 0 ]]; then
            log_error "Validation failed with $errors errors."
            return 1
        fi
        log_success "All skills validated successfully!"
    fi
}

# Install skills-sync globally
cmd_install() {
    local target_bin="${HOME}/.local/bin/skills-sync"
    mkdir -p "${HOME}/.local/bin"
    cp "${BASH_SOURCE[0]}" "$target_bin"
    chmod +x "$target_bin"

    log_success "Installed skills-sync to ${BOLD}${target_bin}${NC}"
    if [[ ":$PATH:" != *":${HOME}/.local/bin:"* ]]; then
        log_warn "Make sure ~/.local/bin is in your PATH. Add this to your ~/.bashrc or ~/.zshrc:"
        echo '  export PATH="$HOME/.local/bin:$PATH"'
    fi
}

# Main Command Switch
case "${1:-}" in
    pull)
        cmd_pull
        ;;
    push)
        shift
        cmd_push "${1:-}"
        ;;
    sync)
        cmd_sync
        ;;
    new|create)
        shift
        cmd_new "${1:-}"
        ;;
    list|ls)
        cmd_list
        ;;
    validate|check)
        cmd_validate
        ;;
    install)
        cmd_install
        ;;
    help|-h|--help)
        show_help
        ;;
    version|-v|--version)
        echo "skills-sync v${VERSION} — MishraShardendu22/agent-skills"
        ;;
    *)
        if [[ -z "${1:-}" ]]; then
            show_help
        else
            log_error "Unknown command: $1"
            show_help
            exit 1
        fi
        ;;
esac
