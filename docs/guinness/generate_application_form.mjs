import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import PDFDocument from 'pdfkit'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(__dirname, 'SerendipEatery-Guinness-Application-Form.pdf')

const doc = new PDFDocument({
  size: 'LETTER',
  margins: { top: 48, bottom: 40, left: 54, right: 54 },
  bufferPages: true,
  info: {
    Title: 'Guinness World Records Application — SerendipEatery',
    Author: 'SerendipEatery',
  },
})
const stream = fs.createWriteStream(out)
doc.pipe(stream)

const orange = '#F7941D'
const night = '#0f0a1e'
const ink = '#1a1230'
const left = 54
const width = 504

function kicker(t) {
  doc.fillColor(orange).font('Helvetica-Bold').fontSize(8).text(t, left, doc.y, { width })
  doc.moveDown(0.35)
}

function title(t) {
  doc.fillColor(night).font('Helvetica-Bold').fontSize(15).text(t, left, doc.y, { width })
  doc.moveDown(0.4)
}

function h(t) {
  doc.moveDown(0.45)
  doc.fillColor(night).font('Helvetica-Bold').fontSize(11).text(t, left, doc.y, { width })
  doc.moveDown(0.2)
}

function p(t) {
  doc.fillColor(ink).font('Helvetica').fontSize(9).text(t, left, doc.y, { width, align: 'justify', lineGap: 1.5 })
  doc.moveDown(0.25)
}

function fields(rows) {
  for (const [label, value] of rows) {
    if (doc.y > 720) doc.addPage()
    const y = doc.y
    doc.save()
    doc.strokeColor(orange).lineWidth(0.5).rect(left, y, width, 20).stroke()
    doc.restore()
    doc.fillColor(night).font('Helvetica-Bold').fontSize(7).text(label, left + 6, y + 6, { width: 120, lineBreak: false })
    doc.fillColor(ink).font('Helvetica').fontSize(8).text(value || '______________________________', left + 130, y + 6, { width: width - 140, lineBreak: false })
    doc.y = y + 24
  }
}

kicker('OFFICIAL RECORD APPLICATION')
title('Largest online asynchronous rock-paper-scissors tournament')
p('Submit this packet through the Guinness World Records organisation account, together with RULES.md, EVIDENCE.md and WITNESS-PLAN.md. Do not start the official count until written guidelines arrive. The software auto-starts the official bracket only after 50,000 phone-verified signups.')

h('1. Applicant')
fields([
  ['Organisation', 'SerendipEatery'],
  ['Contact name', ''],
  ['Role', 'Record attempt organiser'],
  ['Email', ''],
  ['Phone', ''],
  ['City / Country', 'United States'],
  ['Postal address', ''],
])

h('2. Proposed record')
fields([
  ['Proposed title', 'Largest online asynchronous rock-paper-scissors tournament'],
  ['Related title', 'Largest RPS tournament — 10,033, Tianjin Joy City, 24 Dec 2019'],
  ['Why a new title', 'Existing title is in-person. This attempt is one global async single-elim app tournament.'],
  ['Who may attempt', 'An organisation'],
  ['Location', 'Online / worldwide. Play in the official app. Live bracket on the web.'],
  ['Entry fee / prize', 'None. Free to enter. No cash prize.'],
])

h('3. How it is measured')
p('The record number is official participants in one single-elimination tournament: a unique person who registered a legal name, verified a unique mobile phone by OTP, attested the minimum age, consented to the roster and SMS, and either locked at least one throw or received a documented first-round bye after freeze. Duplicate phones, unverified phones, and no-shows who never threw are excluded from the submitted count.')

h('4. Format and automation')
p('Registration stays open until 50,000 phone-verified players. At that threshold the system automatically freezes registration, publishes a freeze seed and roster hash, generates one single-elimination bracket (byes if needed), and texts every live player. Each match is first to two winning throws. Both players lock a sealed sequence of three throws. Default deadline: 48 hours, with SMS at match-live, 24 hours, and 1 hour. Auto-forfeit if only one player locked. If neither locked, both are no-shows; one advances by documented coin-flip. Pure no-shows are not official participants.')
p('While the 50,000 count is filling, any verified registrant may host invite-only friend tournaments (“winner decides what we do tonight”). Those social brackets use the same engine and are logged as dry-run evidence (social_bracket_test).')

doc.addPage()
h('5. Dates (auto-triggered)')
fields([
  ['Registration opens', 'After written guidelines are received'],
  ['Official freeze / Round 1', 'Automated: the moment verified signups exceed 50,000'],
  ['Match deadline', '48 hours from a match becoming live'],
  ['Expected duration', 'Up to 16 rounds x 48 hours, about 32 days after freeze'],
  ['Close', 'When the final completes; status becomes pending_verification'],
])

h('6. Evidence (automated)')
p('• SHA-256 hash-chained event log for every registration, lock, result, and forfeit.')
p('• Frozen roster CSV (legal name, verified phone, timestamps, IP, official flag).')
p('• Full match log and SMS log. Automatic snapshots at freeze, generation, end of each round, and close.')
p('• Public live counter and live bracket. Video: freeze, generation, continuous livestream, and the final.')
p('• Two independent witnesses with read-only access.')

h('7. Independent witnesses')
p('Name two people who are not employees and have no financial interest in the result.')
fields([
  ['Witness 1 name', ''],
  ['Witness 1 email / role', ''],
  ['Witness 2 name', ''],
  ['Witness 2 email / role', ''],
  ['Livestream URL', ''],
])

h('8. Questions for Records Management')
p('Please issue guidelines on: (1) new title vs existing in-person title; (2) 48-hour deadlines and auto-forfeit; (3) whether a first-round bye counts; (4) no-show counting; (5) identity standard; (6) steward ratio for a digital event; (7) video for a multi-week async attempt; (8) whether pre-freeze social brackets may be cited as dry-run evidence.')

h('9. Organiser declaration')
p('I confirm this application is true, that SerendipEatery will follow the guidelines Guinness issues, that the official attempt will not begin until those guidelines arrive, and that the 50,000-player auto-start will be disabled if Guinness requires a different freeze rule.')
fields([
  ['Organiser signature', ''],
  ['Print name', ''],
  ['Date', ''],
])

doc.end()
await new Promise((resolve, reject) => {
  stream.on('finish', resolve)
  stream.on('error', reject)
})
console.log('wrote', out)
