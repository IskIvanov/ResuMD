# A walkthrough of the CLI, recorded with VHS (https://github.com/charmbracelet/vhs).
#
#   brew bundle         # installs VHS (and ttyd, ffmpeg) from the Brewfile
#   bun run demo        # writes docs/assets/demo.gif
#
# Run it from the repo root. It runs the CLI in a throwaway folder with a
# throwaway HOME, so it never reads your saved settings or a .env here, and
# never writes a Resume.md into the repo. The API key it types is made up, and
# the Connect run is declined, so nothing is sent to Reactive Resume.
#
# Each keystroke waits for the prompt it answers (`Wait /…/`), so a slow
# machine records the same walkthrough instead of typing into the wrong prompt.

Output docs/assets/demo.gif

Require bun

Set Shell "bash"
Set FontSize 16
Set Width 1200
Set Height 640
Set Padding 24
Set Theme "Catppuccin Mocha"
Set TypingSpeed 60ms
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

# 1. The menu lists platforms first, then the tools that need no platform.
Type "bun run cli"
Sleep 500ms
Enter
Wait+Screen /Select a platform/
Sleep 2s

# 2. Reactive Resume: its tools stay disabled until you connect.
Enter
Wait+Screen /Which Reactive Resume tool/
Sleep 3s

# 3. Back to the top (the list wraps), then write the example resume.
Up
Sleep 500ms
Up
Sleep 1s
Enter
Wait+Screen /Select a platform/
Sleep 500ms
Down
Sleep 1s
Enter

# The output path is optional (default Resume.md): leave it unticked. The menu
# prints the direct command before it runs.
Wait+Screen /Set any optional flags/
Sleep 1.5s
Enter
Wait+Screen /Run it\?/
Sleep 1.5s
Enter
Wait+Screen /Wrote an example Resume.md/
Sleep 2s

# 4. A peek at what it wrote.
Type "head -n 14 Resume.md"
Sleep 500ms
Enter
Sleep 4s
Type "clear"
Enter

# 5. Connect: the API key is typed hidden and masked in the printed command.
Type "bun run cli"
Sleep 500ms
Enter
Wait+Screen /Select a platform/
Sleep 1s
Enter
Wait+Screen /Which Reactive Resume tool/
Sleep 1.5s
Enter
Wait+Screen /API key/
Sleep 500ms
Type "rx_demo_not_a_real_key"
Sleep 800ms
Enter
Wait+Screen /Set any optional flags/
Sleep 1.5s
Enter
Wait+Screen /Run it\?/
Sleep 2s

# Declined, so nothing is sent; the menu comes back. Exit.
Type "n"
Sleep 500ms
Enter
Sleep 2.5s
Down
Sleep 400ms
Down
Sleep 700ms
Enter
Wait+Line /resumd \$/
Sleep 1s

# 6. Every tool also runs directly, and never overwrites a file.
Type "bun run cli example-resume --output Resume.md"
Sleep 500ms
Enter
Wait+Screen /already exists/
Sleep 4s
