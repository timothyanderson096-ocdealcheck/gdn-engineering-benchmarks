# One day of human-reviewed open-source work

On 18 November 2026, Timothy Anderson of Spotted Ridge Engineering / OC Labs opened **50 public pull requests across 26 external GitHub repositories**. The first opened at 9:40:42 am and the fiftieth at 11:16:25 pm, Brisbane time. Tim directed the work using ChatGPT and GDN, his parallel checking system, and personally reviewed the results. Some changes had already been prepared and tested. The timestamps measure publication. [GitHub activity for the day](https://github.com/search?type=pullrequests&q=is%3Apr%20is%3Apublic%20author%3Atimothyanderson096-ocdealcheck%20-user%3Atimothyanderson096-ocdealcheck%20created%3A2026-11-17T14%3A00%3A00Z..2026-11-18T13%3A59%3A59Z)

## How unusual was 50?

**Only 321 of 338,205 active account-days reached 50 public PR openings** in a five-weekday GH Archive sample from 18–22 November 2024. That is **0.0949%**, about **one in 1,054**. Fifty falls in the **top 0.1% of this sample by daily submission volume**. The metric counts proposed changes. The tests and the maintainers’ decisions can be inspected separately below.

Each observation represents one account on one Brisbane day when it opened at least one public PR. The query counts distinct repository and PR-number pairs, includes ties at 50 and excludes accounts whose logins end in `[bot]`. Automation can also use other account names. The archive includes PRs to contributors’ own repositories. It records public events and can miss activity visible in a later GitHub search. It does not identify an individual’s hours, review practice, or skill. [GH Archive](https://www.gharchive.org/) · [Run the benchmark query](https://play.clickhouse.com/?user=play&query=SELECT%20count()%20AS%20active_account_days%2C%20countIf(prs%20%3E%3D%2050)%20AS%20days_with_50_or_more%0AFROM%20(%0A%20%20%20%20SELECT%20toDate(created_at%2C%20'Australia%2FBrisbane')%20AS%20local_day%2C%0A%20%20%20%20%20%20%20%20%20%20%20creator_user_login%2C%0A%20%20%20%20%20%20%20%20%20%20%20uniqExact((repo_name%2C%20number))%20AS%20prs%0A%20%20%20%20FROM%20github_events%0A%20%20%20%20WHERE%20event_type%20%3D%20'PullRequestEvent'%20AND%20action%20%3D%20'opened'%0A%20%20%20%20%20%20AND%20creator_user_login%20!%3D%20''%20AND%20NOT%20endsWith(creator_user_login%2C%20'%5Bbot%5D')%0A%20%20%20%20%20%20AND%20created_at%20%3E%3D%20toDateTime('2024-11-17%2014%3A00%3A00'%2C%20'UTC')%0A%20%20%20%20%20%20AND%20created_at%20%3C%20%20toDateTime('2024-11-22%2014%3A00%3A00'%2C%20'UTC')%0A%20%20%20%20GROUP%20BY%20local_day%2C%20creator_user_login%0A)%0AFORMAT%20TSVWithNames)

## People doing comparable work

For these examples we counted publicly searchable PRs opened on the stated Brisbane day to repositories outside the author’s own GitHub username. An organisation repository can include projects the contributor maintains. Steinberger, @shiminshen and Park each describe their use of AI for open-source work. Their accounts document a workflow, while the linked GitHub searches establish daily totals. These examples illustrate scale and practice and do not define a population of solo enthusiasts.

| Contributor | Brisbane date | Public external PRs opened | Repositories | Context |
|---|---|---:|---:|---|
| [Timothy Anderson](https://github.com/search?type=pullrequests&q=is%3Apr%20is%3Apublic%20author%3Atimothyanderson096-ocdealcheck%20-user%3Atimothyanderson096-ocdealcheck%20created%3A2026-11-17T14%3A00%3A00Z..2026-11-18T13%3A59%3A59Z) | 18 Nov 2026 | 50 | 26 | ChatGPT, parallel GDN checks and Tim’s personal review. |
| [Peter Steinberger](https://github.com/search?type=pullrequests&q=is%3Apr%20is%3Apublic%20author%3Asteipete%20-user%3Asteipete%20created%3A2026-11-15T14%3A00%3A00Z..2026-11-16T13%3A59%3A59Z) | 16 Nov 2026 | 84 | 20 | All 84 went to the OpenClaw organisation. Including repositories under his own username, his public count was [118](https://github.com/search?type=pullrequests&q=is%3Apr%20is%3Apublic%20author%3Asteipete%20created%3A2026-11-15T14%3A00%3A00Z..2026-11-16T13%3A59%3A59Z). Steinberger [describes directing coding agents](https://steipete.me/posts/2025/shipping-at-inference-speed) and reviewing selected parts of their output. |
| [@shiminshen](https://github.com/search?type=pullrequests&q=is%3Apr%20is%3Apublic%20author%3Ashiminshen%20-user%3Ashiminshen%20created%3A2026-05-15T14%3A00%3A00Z..2026-05-16T13%3A59%3A59Z) | 16 May 2026 | 7 | 3 | Work across Mastra, pnpm and CopilotKit. The contributor’s [published workflow](https://github.com/shiminshen/oss-contribute) requires personal confirmation before an upstream PR opens. |
| [David Park](https://github.com/search?type=pullrequests&q=is%3Apr%20is%3Apublic%20author%3Adparkmit24%20-user%3Adparkmit24%20created%3A2026-08-10T14%3A00%3A00Z..2026-08-11T13%3A59%3A59Z) | 11 Aug 2026 | 5 | 2 | Work in Dify and its official plugins. Park [describes directing two AI agents](https://dparkmit.substack.com/p/your-first-pull-request-used-to-be) on open-source contributions. |
| [Kirill Müller](https://github.com/search?type=pullrequests&q=is%3Apr%20is%3Apublic%20author%3Akrlmlr%20-user%3Akrlmlr%20created%3A2024-11-20T14%3A00%3A00Z..2024-11-21T13%3A59%3A59Z) | 21 Nov 2024 | 34 | 29 | A high-volume multi-project example including repeated CI maintenance and [DuckDB work](https://github.com/duckdb/duckdb-r/pull/594). The count excludes six PRs to his own namespace. |

## What the tests caught

- **GPSBabel dropped all 188 course cues in two cycling recordings.** A comparison with the Garmin FIT SDK verified the repaired conversion preserved cue types, times and locations. All 76 project tests passed. [GPSBabel #1674](https://github.com/GPSBabel/gpsbabel/pull/1674)
- **Pexpect could fail before it started a program that wrote UTF-16LE output.** The new regression launches a real child process and reads its output. The regression failed on the original code and all 258 project tests passed on the fix. [Pexpect #850](https://github.com/pexpect/pexpect/pull/850)
- **cmd2 could suggest the wrong executable for a Windows path.** Two regression cases failed before the fix and passed afterwards. The maintainers merged this change on 18 November. [cmd2 #1830](https://github.com/python-cmd2/cmd2/pull/1830) · [Hosted test run](https://github.com/python-cmd2/cmd2/actions/runs/44218778210)

## All 50 submissions

The links below identify the 50 distinct upstream PRs, including submissions that may subsequently merge or close.

| Upstream repository | Pull requests |
|---|---|
| adafruit/Adafruit_CircuitPython_GPS | [#133](https://github.com/adafruit/Adafruit_CircuitPython_GPS/pull/133), [#134](https://github.com/adafruit/Adafruit_CircuitPython_GPS/pull/134), [#135](https://github.com/adafruit/Adafruit_CircuitPython_GPS/pull/135) |
| Alir3z4/html2text | [#471](https://github.com/Alir3z4/html2text/pull/471) |
| briancurtin/deprecation | [#69](https://github.com/briancurtin/deprecation/pull/69), [#70](https://github.com/briancurtin/deprecation/pull/70) |
| canopen-python/canopen | [#688](https://github.com/canopen-python/canopen/pull/688), [#689](https://github.com/canopen-python/canopen/pull/689), [#690](https://github.com/canopen-python/canopen/pull/690) |
| cantools/cantools | [#889](https://github.com/cantools/cantools/pull/889), [#890](https://github.com/cantools/cantools/pull/890), [#891](https://github.com/cantools/cantools/pull/891), [#892](https://github.com/cantools/cantools/pull/892) |
| collin80/SavvyCAN | [#1184](https://github.com/collin80/SavvyCAN/pull/1184) |
| danielhrisca/asammdf | [#1337](https://github.com/danielhrisca/asammdf/pull/1337) |
| ebroecker/canmatrix | [#947](https://github.com/ebroecker/canmatrix/pull/947), [#948](https://github.com/ebroecker/canmatrix/pull/948) |
| eea/odfpy | [#165](https://github.com/eea/odfpy/pull/165) |
| georust/gpx | [#115](https://github.com/georust/gpx/pull/115) |
| GeoscienceAustralia/GeodePy | [#183](https://github.com/GeoscienceAustralia/GeodePy/pull/183), [#184](https://github.com/GeoscienceAustralia/GeodePy/pull/184), [#185](https://github.com/GeoscienceAustralia/GeodePy/pull/185), [#186](https://github.com/GeoscienceAustralia/GeodePy/pull/186), [#187](https://github.com/GeoscienceAustralia/GeodePy/pull/187) |
| GPSBabel/gpsbabel | [#1673](https://github.com/GPSBabel/gpsbabel/pull/1673), [#1674](https://github.com/GPSBabel/gpsbabel/pull/1674) |
| hardbyte/python-can | [#2134](https://github.com/hardbyte/python-can/pull/2134), [#2135](https://github.com/hardbyte/python-can/pull/2135), [#2136](https://github.com/hardbyte/python-can/pull/2136), [#2139](https://github.com/hardbyte/python-can/pull/2139) |
| inmcm/micropyGPS | [#52](https://github.com/inmcm/micropyGPS/pull/52), [#53](https://github.com/inmcm/micropyGPS/pull/53) |
| jazzband/tablib | [#754](https://github.com/jazzband/tablib/pull/754) |
| Knio/pynmea2 | [#192](https://github.com/Knio/pynmea2/pull/192), [#193](https://github.com/Knio/pynmea2/pull/193) |
| mapbox/mercantile | [#157](https://github.com/mapbox/mercantile/pull/157) |
| mobilityhouse/ocpp | [#797](https://github.com/mobilityhouse/ocpp/pull/797) |
| openradar/xradar | [#602](https://github.com/openradar/xradar/pull/602) |
| pexpect/pexpect | [#848](https://github.com/pexpect/pexpect/pull/848), [#849](https://github.com/pexpect/pexpect/pull/849), [#850](https://github.com/pexpect/pexpect/pull/850) |
| polyvertex/fitdecode | [#43](https://github.com/polyvertex/fitdecode/pull/43) |
| PyCQA/docformatter | [#417](https://github.com/PyCQA/docformatter/pull/417) |
| pygments/pygments | [#3488](https://github.com/pygments/pygments/pull/3488), [#3489](https://github.com/pygments/pygments/pull/3489) |
| python-cmd2/cmd2 | [#1830](https://github.com/python-cmd2/cmd2/pull/1830) |
| tkrajina/gpxpy | [#329](https://github.com/tkrajina/gpxpy/pull/329), [#330](https://github.com/tkrajina/gpxpy/pull/330), [#331](https://github.com/tkrajina/gpxpy/pull/331) |
| wireservice/agate-sql | [#70](https://github.com/wireservice/agate-sql/pull/70) |

## Reproduce the historical comparison

The query runs against the public ClickHouse `github_events` mirror. Its inclusive start and exclusive end cover five complete Brisbane weekdays.

```sql
SELECT count() AS active_account_days, countIf(prs >= 50) AS days_with_50_or_more
FROM (
    SELECT toDate(created_at, 'Australia/Brisbane') AS local_day,
           creator_user_login,
           uniqExact((repo_name, number)) AS prs
    FROM github_events
    WHERE event_type = 'PullRequestEvent' AND action = 'opened'
      AND creator_user_login != '' AND NOT endsWith(creator_user_login, '[bot]')
      AND created_at >= toDateTime('2024-11-17 14:00:00', 'UTC')
      AND created_at <  toDateTime('2024-11-22 14:00:00', 'UTC')
    GROUP BY local_day, creator_user_login
)
FORMAT TSVWithNames
```
