# AIML Result Analyzer

**University-grade result analysis platform** for B.E. Computer Science and Engineering  
**(Artificial Intelligence and Machine Learning)** — Jeppiaar Engineering College  
(Affiliated to Anna University, Chennai)

Designed for **3rd-year (and 2nd-year) AIML students** and faculty to analyse provisional  
examination results published by the Office of the Controller of Examinations.

---

## 1. Purpose & Scope

This tool follows standard university result-analysis practice:

| Step | Activity | How this app supports it |
|------|----------|---------------------------|
| 1 | Collect official grade sheets | Upload CSV / Excel exported from COE PDF or college ERP |
| 2 | Normalise grades | Maps O, A+, A, B+, B, C+, C, U, UA, S, W, I to grade points |
| 3 | Compute performance metrics | GPA (simple), clear-pass %, arrear count |
| 4 | Subject-wise analysis | Pass rate, failure count, modal grade per paper |
| 5 | Identify at-risk students | Dedicated Arrears dashboard |
| 6 | Rank & recognise | Top performers by GPA |
| 7 | Report & export | One-click CSV export for further Excel / ERP use |

---

## 2. Anna University Grade Scale (used)

| Grade | Points | Meaning |
|-------|--------|---------|
| O / S | 10 | Outstanding |
| A+    | 9  | Excellent |
| A     | 8  | Very Good |
| B+    | 7  | Good |
| B     | 6  | Above Average |
| C+    | 5  | Average |
| C     | 4  | Satisfactory |
| U     | 0  | Reappear (Fail) |
| UA    | 0  | Absent |
| W / I | 0  | Withdrawal / Inadequate Attendance |

**Clear Pass** = zero U / UA / W / I in the analysed semester.  
**GPA** = average of grade points of papers with a recorded grade (each paper treated as equal weight for simplicity).

---

## 3. Features

- **Dashboard** — Students count, Clear-pass %, Average GPA, students with arrears  
- **Grade distribution chart** — visual of O → U  
- **Subject-wise pass-rate chart & table**  
- **Students browser** — search + filter (Clear / Has Arrears)  
- **Student detail modal** — full grade card  
- **Arrears view** — who failed which papers + hardest subject  
- **Export** — analysed data as CSV  
- **Sample data** — Semester-4 provisional results (April/May 2026) pre-loaded  

---

## 4. How to use

1. Open the deployed site (or open `index.html` locally).
2. Click **Upload Data → Load AIML Sem-4 Sample** for an instant demo.
3. Or upload your own file:

### Expected CSV / Excel columns

```
Reg No, Student Name, Semester, AD3381, AD3391, AL3391, AL3411, AL3451, AL3452, CS3452, GE3451, ...
```

- Subject headers = official subject codes  
- Cell values = letter grades (O, A+, A, B+, B, C+, C, U, UA, …)  
- Empty cells are ignored  

---

## 5. Drawbacks of typical result analysis & how this tool handles them

| Common drawback | Risk | Mitigation in this app |
|-----------------|------|------------------------|
| PDF-only official sheets | Hard to analyse | Accepts CSV/Excel; sample extracted from COE PDF |
| Inconsistent grade notation (A+, A +, AP) | Parsing errors | Normaliser accepts common OCR / typing variants |
| Missing credits / unequal paper weights | Incorrect GPA | Documents that GPA is **equal-weight**; real CGPA needs credit mapping (future) |
| Multiple name spellings / register formats | Duplicate or unmatched students | Uses Register Number as primary key |
| U vs UA confusion | Wrong arrear count | Both treated as fail; shown distinctly in grade card |
| No subject difficulty view | Cannot prioritise remedial classes | Subject pass-rate + “Hardest Subject” KPI |
| Manual ranking | Time-consuming & error-prone | Automatic Top-10 by GPA (tie-break: fewer arrears) |
| Privacy of student data | Cloud leakage | **100 % client-side** — nothing uploaded to any server |
| One-semester only | No progression view | Semester column supported; multi-semester upload possible |
| Faculty need printable reports | Extra work | Export CSV → open in Excel / Google Sheets for formatting |

---

## 6. Standard analysis checklist (recommended for class advisors)

1. Load the semester grade file.  
2. Note overall Clear-pass % and Average GPA.  
3. Open **Arrears** → list students with U/UA and the failed subjects.  
4. Identify the **Hardest Subject** (lowest pass %).  
5. Cross-check with attendance / continuous-assessment data (outside this tool).  
6. Export CSV and archive with the official COE PDF for audit.  
7. Plan remedial / coaching for high-failure subjects before the next attempt.

---

## 7. Tech stack

- Pure HTML / CSS / Vanilla JS (no build step)
- Chart.js — visualisations  
- Papa Parse — CSV  
- SheetJS — Excel  
- Deployed on Vercel (static)

---

## 8. Local run

```bash
# any static server
python3 -m http.server 8080
# or
npx serve .
```

Open http://localhost:8080

---

## 9. Privacy & disclaimer

- All computation happens in the browser.  
- No student data is transmitted.  
- This is an **analysis aid**, not an official COE document.  
- Always verify critical decisions against the original provisional result PDF issued by Anna University.

---

## 10. Institution context

- **College**: Jeppiaar Engineering College (Inst. Code 3108)  
- **Programme**: 148 – B.E. CSE (Artificial Intelligence and Machine Learning)  
- **Affiliation**: Anna University, Chennai  
- **Sample data**: Provisional Results of April / May Examination, 2026 (Semester 4)

---

*Built for the AIML batch — analyse fast, act on arrears, improve outcomes.*
