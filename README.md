# HCI Timetable Planner

M.Sc. HCI 학생이 University of Siegen의 **Winter Semester 2026/27**과 **Summer Semester 2027** 수업을 골라 시간표 버전을 만들고 비교하는 앱입니다.

수업 데이터는 `data/ws26_27_courses.js`에 있습니다. 공식 값이 없는 항목은 TBA로 두고, 개설 주기만으로 여름학기 수업을 만들지 않습니다.

```bash
export PATH="$HOME/.local/node-v22.20.0-darwin-arm64/bin:$PATH"
npm install
npm run dev
```

시간표, 버전 이름, 선택한 학기는 브라우저 `localStorage`에 저장됩니다.
