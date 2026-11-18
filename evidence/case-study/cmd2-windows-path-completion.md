# Windows tab completion suggested an executable from the wrong folder

On 18 November 2026, cmd2 merged Timothy Anderson’s fix for a path-completion bug in its Python command-line framework. The failure showed up as you typed a command and pressed Tab.

## Reproducing the wrong suggestion

The regression test creates two files. The current folder contains `my-local.exe`. A different folder on `PATH` contains `my-other.exe`. At the cmd2 prompt, enter `shell ./my` and press Tab. The `./` specifies the current folder, so only the local file should be suggested.

The old code recognised a Windows backslash when deciding whether the input contained a path. A forward slash slipped through. That sent the partial name to the lookup that searches `PATH`. In a second case, completing an absolute path written with forward slashes could drop the directory from the suggestion.

## The fix and its evidence

Maintainer T. Leonhardt identified the separator issue and suggested checking Python’s alternative path separator. The patch routes either separator to cmd2’s existing path completer. Two regression tests cover relative and absolute paths. Both failed before the change and passed afterwards.

The local Linux run passed all 155 completion tests. The upstream test run also passed six Windows configurations, alongside Linux and macOS. The maintainer confirmed both reported cases and merged the contribution. This work concerns suggestions inside applications built with cmd2.

[Original issue and proposed diagnosis](https://github.com/python-cmd2/cmd2/issues/1820) · [Accepted patch and test changes](https://github.com/python-cmd2/cmd2/pull/1830/files) · [Hosted test results](https://github.com/python-cmd2/cmd2/actions/runs/44218778210)

## Have a similar bug?

Tell us which input produced the wrong result and what you expected instead. We assess one reproducible bug for free. An eligible, tested fix costs A$19.99 if you choose to buy it. [Request a free assessment at OC Labs](https://oc-labs.com.au/?utm_source=github&utm_medium=referral&utm_campaign=cmd2-case-study#start).

Timothy Anderson · Spotted Ridge Engineering / OC Labs · GDN (Global Decision Network). Prepared with OpenAI Codex. Contact: timothyanderson096@gmail.com.
