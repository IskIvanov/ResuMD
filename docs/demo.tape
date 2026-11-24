# A walkthrough of the CLI, recorded with VHS (https://github.com/charmbracelet/vhs).
#
#   brew bundle         # installs VHS (and ttyd, ffmpeg) from the Brewfile
#   bun run demo        # writes docs/assets/demo.gif
#
# Run it from the repo root. It runs the CLI in a throwaway folder with a
# throwaway HOME, so it never reads your saved settings or a .env here, and
# never writes a Resume.md into the repo.
#
# The walkthrough writes the example resume through the menu, with its
# --output flag set to Resume.md, then opens the file in vi. Each step is
# introduced by a `# …` comment typed at the prompt, which bash ignores.
#
# Each keystroke waits for the prompt it answers (`Wait /…/`), so a slow
# machine records the same walkthrough instead of typing into the wrong prompt.

Output docs/assets/demo.gif

Require bun
Require vi

Set Shell "bash"
Set FontSize 24
Set Width 1400
Set Height 800
Set Padding 32
Set Theme "Catppuccin Mocha"
Set TypingSpeed 50ms
Set WaitTimeout 20s

# Setup, off camera: a clean folder where `bun run cli` runs this repo's CLI,
# without Bun loading a .env or echoing the script's full path.
Hide
Type `export REPO="$PWD" DEMO=/tmp/resumd-demo; rm -rf "$DEMO"; mkdir "$DEMO"; cd "$DEMO"; export HOME="$DEMO"`
Enter
Type `unset RXRESUME_API_KEY RXRESUME_API_URL RXRESUME_APP_URL RXRESUME_DEBUG`
Enter
Type `bun() { if [ "$1 $2" = "run cli" ]; then shift 2; command bun --no-env-file "$REPO/src/cli/index.ts" "$@"; else command bun "$@"; fi; }`
Enter
Type `export PS1="\[\e[1;35m\]resumd\[\e[0m\] $ "; clear`
Enter
Wait+Line /resumd \$/
Show

# 1. Open the menu.
Type "# Step 1: open the menu and pick Example resume"
Enter
Sleep 1s
Type "bun run cli"
Sleep 500ms
Enter
Wait+Screen /Select a platform/
Sleep 2s

# Example resume is the tool that needs no platform.
Down
Sleep 1.5s
Enter

# 2. Tick the optional --output flag and name the file.
Wait+Screen /Set any optional flags/
Sleep 1.5s
Space
Sleep 1.5s
Enter
Wait+Screen /Path to save Resume.md to/
Sleep 1s
Type "Resume.md"
Sleep 1s
Enter

# 3. The menu prints the direct command, then asks before running it.
Wait+Screen /Run it\?/
Sleep 3s
Enter
Wait+Screen /Wrote an example Resume.md/
Wait+Line /resumd \$/
Sleep 3s

# 4. Open what it wrote in vi, scroll slowly down to the end so each section's
# Markdown is readable, then back up to the top, and quit.
Type "# Step 2: open the new Resume.md to see its Markdown"
Enter
Sleep 1s
Type "vi Resume.md"
Sleep 500ms
Enter
Wait+Screen /Jane Doe/
Sleep 3s

# Down: half a screen at a time (Ctrl+D), pausing on each page so its
# Markdown can be read. Line-by-line scrolling redraws every frame and made
# the GIF 18 MB; half pages keep it small.
Ctrl+D
Sleep 2s
Ctrl+D
Sleep 2s
Ctrl+D
Sleep 2s
Ctrl+D
Sleep 2s
Ctrl+D
Sleep 2s
Ctrl+D
Sleep 2s
Ctrl+D
Sleep 2s
Ctrl+D
Sleep 3s

# Up: back to the top (Ctrl+U), faster.
Ctrl+U
Sleep 700ms
Ctrl+U
Sleep 700ms
Ctrl+U
Sleep 700ms
Ctrl+U
Sleep 700ms
Ctrl+U
Sleep 700ms
Ctrl+U
Sleep 700ms
Ctrl+U
Sleep 700ms
Ctrl+U
Sleep 2s
Type ":q"
Sleep 800ms
Enter
Wait+Line /resumd \$/
Sleep 1s
Type "# Done: edit Resume.md, then run bun run cli to connect a platform"
Enter
Sleep 4s
