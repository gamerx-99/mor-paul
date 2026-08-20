# National ID and Smart Card Design Notes

## Scope

The patient record will accept a Thai national identification number through a controlled Front Desk workflow. The value is **write-once**: after a successful initial save, no role may update it through the application. Any exceptional correction must remain outside the routine workflow and requires a separately approved operational process.

The application will never return the complete identifier after persistence. Allowed read surfaces use the canonical masked representation: the first two digits, eight masking characters, and the last three digits, for example `12••••••••345`.

## External reference captured for validation design

The Thai government data-standard catalogue describes the citizen identification value as a **13-digit character field** and identifies the presence of a check digit. The page could not be text-extracted in this environment; it is retained as the design reference and the checksum implementation will be covered by deterministic tests before rollout.

Source: [Citizen Identification: หมายเลขประจำตัวประชาชน — มาตรฐานข้อมูลกลาง](https://datastandard.m-society.go.th/datatable/index/1)

## Smart Card boundary

A browser-hosted web application cannot directly rely on a clinic workstation's PC/SC reader driver. The HIS will therefore define a narrow, future local-reader bridge contract that supplies only an identifier to a signed-in Front Desk session. The web application remains usable through manual entry when no approved local bridge is present. It will not install drivers, store card images, or accept unverified patient data from the browser.
