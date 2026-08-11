# Reporting a result

**Use `MsgBox`.** During a batch no dialog opens - SwMacroFlow defines its own `MsgBox` inside the
throwaway copy it runs, so each call becomes that file's row in the results list instead.

```vb
If Not model.ForceRebuild3(False) Then
    MsgBox "Rebuild failed", vbCritical   ' red row, batch continues to the next file
    Exit Sub
End If

MsgBox "Exported " & n & " configs"       ' green row
```

Your macro needs no SwMacroFlow-specific code, and it still shows real dialogs when you run it
yourself in the VBA editor. The macro is identical either way.

## What makes a file pass or fail

| In your macro | Row | Returns |
|---|---|---|
| `MsgBox "text"` | Green - a status note | `vbOK` |
| `MsgBox "text", vbCritical` | **Red - the file failed** | `vbOK` |
| `MsgBox "text", vbExclamation` / `vbInformation` / `vbQuestion` | Green - status | `vbOK` |
| `MsgBox "text", vbYesNo` | Amber - prompt auto-answered | `vbNo` |
| `MsgBox "text", vbOKCancel` | Amber | `vbCancel` |
| `MsgBox "text", vbYesNoCancel` | Amber | `vbCancel` |
| `MsgBox "text", vbRetryCancel` | Amber | `vbCancel` |
| `MsgBox "text", vbAbortRetryIgnore` | Amber | `vbAbort` |
| `InputBox("...", , "42")` | Amber | `"42"` - the default you supplied |
| An unhandled runtime error | Red, with number and description | - |
| Missing `{Property}` / no document to resolve it | Red, named error from the host | - |
| Nothing at all | Green | - |

`vbCritical` is the marker for failure. Other icons - `vbExclamation`, `vbInformation`,
`vbQuestion` - are status notes and leave the row green.

**A crash no longer passes silently.** An unhandled VBA error is caught, reported as
`Error 91: Object variable or With block variable not set` or similar, and the batch moves on to the
next file. No "Run-time error" dialog appears.

Severity order is **red, then amber, then green**. Within one severity the first message wins, and
the row's status and text always come from the same call.

## Write a message worth reading

A row you will read four hundred of should say what happened to *that* file. `"Wrote
C:\Exports\bracket.pdf"` is useful; `"Done"` is not. Put the value that varies - the path, the
count, the property - in the message.

## Reporting more than once

Call `MsgBox` as often as you like. The row shows the **most severe** message, and the log panel
keeps all of them in order.

```vb
MsgBox "Checked 4 configurations"
MsgBox "Rebuild failed", vbCritical
MsgBox "Cleaned up"
```

That file gets one red row reading *Rebuild failed*, and three lines in the log. The status and the
message always come from the same call, so a failed file never shows the text of a later message
that succeeded.

## Do not ask questions

A batch runs unattended, so there is nobody to click a prompt. Rather than stall, SwMacroFlow answers
on your macro's behalf and marks the file **amber** so you know it happened.

The answer is always the one that **declines**, because neither choice is safe on its own. Returning
`vbOK` would skip the destructive branch in `If MsgBox("Overwrite?", vbYesNo) = vbYes Then Kill f` -
but it would also skip the `Exit Sub` in `If MsgBox("Continue?", vbYesNo) = vbNo Then Exit Sub` and
carry on as though you had agreed.

Amber is deliberate. It is neither a clean pass nor a failure, and after a 400-file batch you cannot
reconstruct which files had a question guessed at for them unless it was recorded.

If a macro needs an answer, make it an **input** instead of a prompt. See *Adding inputs*.

## Property resolution failures

If an input value contains `{Property}` tokens and a property is missing on that document, or there
is no document open to resolve against, the host fails that file with a named error. That shows as a
**red** row - the same severity as `vbCritical` or an unhandled runtime error. See *Adding inputs*.

## The one thing that still hangs a batch

`MsgBox` works because an unqualified call resolves against your macro's own project first. A call
written as **`VBA.MsgBox`** is bound directly to the library instead and cannot be intercepted - it
opens a real dialog and the batch stops dead until someone clicks it. Drop the `VBA.` prefix.

The same applies to a dialog raised from a UserForm. There is no way to intercept one, so a macro
that shows a form cannot run unattended.

For the full authoring contract in one pasteable document, see *Macro authoring spec*.
