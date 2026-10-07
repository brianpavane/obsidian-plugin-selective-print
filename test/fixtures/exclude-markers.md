## Balanced
Keep before.
%% print:exclude %%
Hidden block line.
%% /print:exclude %%
Keep after.
Inline %% print:exclude %%secret%% /print:exclude %% text.

## Nested
%% print:exclude %%
Outer hidden.
%% print:exclude %%
Inner hidden.
%% /print:exclude %%
Still hidden.
%% /print:exclude %%
Visible after nested.

## In code
```
%% print:exclude %%
Literal marker in code stays.
```

## Unmatched start
Visible.
%% print:exclude %%
Hidden to end of section.

## Next section
Visible again.
Stray %% /print:exclude %% end marker.
