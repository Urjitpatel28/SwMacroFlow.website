# Troubleshooting

Symptom first. Each heading is what you actually see.

## "Can't reach SOLIDWORKS"

A connection attempt failed - either one you started from the header, or the one **Run Batch** makes
on its way in. Nothing was run. The message names the reason; there are three.

**"SOLIDWORKS is running but won't accept a connection."** One of the two programs is running as
administrator and the other is not. Windows hides elevated programs from unelevated ones, so they
cannot find each other. Close both and start them the same way - normally, that means neither as
administrator. SwMacroFlow deliberately stops here rather than starting a second SOLIDWORKS on top
of the one you already have open.

**"SOLIDWORKS isn't installed on this machine."** Or it is installed for a different Windows user.
SwMacroFlow drives a real SOLIDWORKS; there is nothing it can do without one.

**"SOLIDWORKS didn't finish starting in time."** It waited five minutes. Open SOLIDWORKS yourself,
let it settle, then run again - it will join the one you opened.

Fix the cause and press **Run Batch** again; nothing about your setup is lost by a failed connect.

## "Some macros did not compile"

The run connected, then loaded each ticked macro through SOLIDWORKS - which compiles its VBA project
and checks it has a runnable `Sub` taking no arguments. At least one did not pass, and the message
names each one with the error it gave.

- **Continue** runs the rest of the chain without them. They stay in the list, still ticked, and the
  next run tries them again.
- **Abort** runs nothing.

The usual causes are the same ones under *A macro won't load* below: VBA references the macro needs
that this SOLIDWORKS does not have, a syntax error, or no `Sub` that can be called with no
arguments. Open the `.swp` in SOLIDWORKS' own macro editor and press Debug > Compile to see the same
error with a line number.

If nothing in the chain compiles, there is nothing to continue with and the run is abandoned without
asking.

## The batch seems to have stopped

Look at SOLIDWORKS. A dialog waiting for an answer blocks everything SwMacroFlow asks it to do, and
a batch is unattended by definition - nobody is watching for the prompt.

Answer the dialog and the run carries on by itself; SwMacroFlow keeps retrying for five minutes
before it gives up on that one file and moves to the next. The log records it after five seconds.

Your own macro's prompts are not the cause: those are answered automatically during a batch and show
as amber rows. This is a dialog from SOLIDWORKS itself.

## "Can't read this macro's VBA project"

Programmatic access to the VBA project is switched off. SwMacroFlow has to read your macro's source
to find its inputs and its entry point, so nothing works until this is on.

In the **SOLIDWORKS VBA editor**: Tools → Options → Security → Trust Center → Macro Settings, then
turn on **Trust access to the VBA project object model**. Reload the macro afterwards - remove the
row and add it again.

## "Macro has a compile error"

The macro is checked when you add it, by asking VBA to compile the whole project without running
anything. Open it in the SOLIDWORKS VBA editor (Tools → Macro → Edit), then Debug → Compile to see
the actual error.

The most common cause in a macro written for SwMacroFlow is an input declared as the wrong type.
Every input must be `As String`, whatever its `Type:` metadata says:

```vb
Const Quantity As Integer = "@Quantity"   ' wrong - type mismatch, will not compile
Const Quantity As String  = "@Quantity"   ' right
```

## "This macro has no runnable procedure"

SwMacroFlow needs a `Sub` that takes no arguments, preferably named `main`. A macro whose only
procedures take arguments, or that contains only `Function`s, has nothing that can be called.

## "This file isn't a readable VBA macro"

The file is not a valid `.swp`, or its VBA project is corrupt. Open it in the VBA editor to confirm.
Only `.swp` files are accepted.

## Run is greyed out

The reason is written next to the button:

| Message | What to do |
|---|---|
| No SOLIDWORKS installation was found on this machine. | There is nothing for the run to connect to. Being disconnected is not itself a reason - **Run Batch** connects for you. |
| Add at least one macro to run. | The macro list is empty. |
| Tick at least one macro to run. | Every macro in the list is unticked. |
| A macro's own error message | That macro's `.swp` could not be read at all. Its row carries a **!** - hover it, then see the sections above. |
| Add at least one file to the scope. | Check the Part / Assembly / Drawing checkboxes as well as the lists. A file in an unticked list is not in scope. |
| Enter a valid whole number for every number input in *macro*. | A number input will not parse. The message names the macro, which may not be the one showing on screen. |
| Fix every property placeholder in *macro*. | A `String`, `FilePath` or `FolderPath` value has malformed `{…}` braces - nested braces, an empty name, or a stray `{` / `}`. |
| Choose a file that exists for every file input in *macro*. | A file input points at a path that is not there (and does not contain `{Property}` tokens). |

A folder path that does not exist yet does **not** block Run. See *Adding inputs*.

## "Fix every property placeholder in …"

Braces in a free-text input are reserved for `{PropertyName}` tokens. Every opening brace needs a
matching close, the name inside must not be empty, and braces cannot nest. Examples of invalid
values: `a{b`, `{ }`, `prefix_{Part{No}}.pdf`.

Fix the typing, or remove the braces if you meant a literal brace character (there is no escape in
v1).

## Red row: property was not found

An input value contained `{SomeName}`, and that property was not on the open document - neither on
the active configuration nor in the file-level custom properties. The batch continues with the next
file; the token is **not** replaced with an empty string.

Check the property name (case does not matter, spelling does), and that the property exists on the
configurations you actually process.

## Red row: cannot resolve … no document is open

A `{Property}` value was used when there was no active document - typically **Run once without
opening any files**, or a file that failed to open. Property placeholders only work against an open
document in a normal batch. Use literal paths or names in run-once mode instead.

## The batch has hung

Something opened a real modal dialog that nobody can click. There are only two ways this happens:

- A call written as **`VBA.MsgBox`**. The `VBA.` prefix binds directly to the library and cannot be
  intercepted. Remove the prefix.
- A **UserForm**. A form's dialog cannot be intercepted either. A macro that shows a form cannot run
  unattended.

Click the dialog to release the batch, then fix the macro.

## Every row is amber

Amber means the macro opened a prompt and SwMacroFlow answered it. Somewhere in the macro there is a
`MsgBox` with a button set other than the plain default, or an `InputBox`, and it is being reached
on every file. The log names the message.

If the macro genuinely needs an answer, make it an input instead of a prompt. See *Adding inputs*.

## Every row is red with `Error 91`

`Error 91: Object variable or With block variable not set` almost always means `ActiveDoc` was used
without checking it first. Add the guard:

```vb
Set model = swApp.ActiveDoc
If model Is Nothing Then Exit Sub
```

In the **Run once without opening any files** mode there is never an active document, so a macro
that needs one will hit this on its single run.

## The rows are green but nothing changed on disk

Closing a document discards unsaved changes, and SwMacroFlow closes each document when the chain is
finished with it. A macro that modifies a document has to save it before returning.

## Files are missing from the scope

- Check the Part / Assembly / Drawing checkboxes. They filter what runs, not what is listed.
- **Include subfolders** is off by default when you browse a folder.
- Only `.sldprt`, `.sldasm` and `.slddrw` are recognised.

## A library macro is missing or unchanged after an upgrade

**From Library** lists `%LOCALAPPDATA%\SwMacroFlow\macros`. Drop a `.swp` there to add your own - the
folder button beside **From Library** opens it for you.

Shipped macros are seeded into that folder. If you edited one, a later upgrade leaves your edit
alone. If you deleted one, it stays deleted. If the local folder cannot be written, the menu still
lists the install copy but you cannot add files to it.

## A macro behaves differently in the VBA editor

Two differences, both expected:

- `MsgBox` shows a real dialog when you run the macro yourself. During a batch it becomes a row.
- `GetCurrentMacroPathName` returns `%TEMP%\SwMacroFlow\run_<id>.swp` during a batch, because
  SwMacroFlow runs a throwaway copy. Your own `.swp` is never modified.

`{Property}` tokens in input values only expand during a batch (per open document). In the VBA
editor you are running the unpatched macro with whatever literal is in the Const.

## Where the logs are

The log panel shows the last 500 lines. The full log is written to a file, one per day, named
`logger_<date>.log`. The folder is shown at the bottom of the log panel - normally a `logs` folder
beside SwMacroFlow, falling back to `%LOCALAPPDATA%\SwMacroFlow\logs` if that is not writable.
Thirty days are kept.

## Leftover files in %TEMP%

Each run copies the macro to `%TEMP%\SwMacroFlow\run_<id>.swp` and deletes it when the batch ends.
A crash can leave one behind; the next run sweeps up anything older than an hour. They are safe to
delete by hand.

## Cancel did not stop it immediately

**Cancel**, and `Ctrl+Shift+Q`, stop the run after the macro in progress finishes - never mid-macro,
so nothing is left half-written. A slow macro on a large assembly can take a while to reach that
point.
