# UI/UX Test Cases

LineMag Application -- Comprehensive UI/UX Test Specification

Last updated: 2026-03-25

---

## 1. Login Page (/login)

| ID     | Description                                                        | Expected Result                                                                 | Priority |
|--------|--------------------------------------------------------------------|---------------------------------------------------------------------------------|----------|
| UI-001 | Logo and branding displayed correctly                              | LineMag logo (green gradient icon + text) centered above the login card         | P1       |
| UI-002 | Email input field visible and functional                           | Input with label "E-mail address", placeholder "admin@example.com", type=email  | P1       |
| UI-003 | Password input field visible and functional                        | Input with label "Password", placeholder dots, type=password, masked characters | P1       |
| UI-004 | Submit button visible and clickable                                | Green button with text "Login" spanning full width of the card                  | P1       |
| UI-005 | Error message displayed on invalid credentials                     | Red banner below inputs shows "Incorrect email or password" text                | P1       |
| UI-006 | Loading state on submit                                            | Button text changes to "Logging in...", button becomes disabled (opacity 50%)   | P1       |
| UI-007 | Responsive layout on mobile (320px)                                | Card remains centered, max-width constrained, padding adjusts                   | P2       |
| UI-008 | Form validation prevents empty submission                          | Browser native required validation fires for empty email/password               | P2       |
| UI-009 | Successful login redirects to /dashboard                           | After valid credentials, user is redirected to the dashboard page               | P1       |

---

## 2. Dashboard Layout (shared across /dashboard/*)

| ID     | Description                                                        | Expected Result                                                                 | Priority |
|--------|--------------------------------------------------------------------|---------------------------------------------------------------------------------|----------|
| UI-010 | Sidebar visible on desktop (>=768px)                               | Fixed 224px sidebar on the left with white background and border                | P1       |
| UI-011 | Hamburger menu visible on mobile (<768px)                          | Top header bar with hamburger icon; sidebar hidden by default                   | P1       |
| UI-012 | Mobile drawer opens on hamburger tap                               | Sidebar slides in from left with backdrop overlay                               | P1       |
| UI-013 | Mobile drawer closes on backdrop tap                               | Drawer slides out, backdrop disappears                                          | P2       |
| UI-014 | All 6 navigation groups displayed                                  | Groups: Delivery, CRM, Coupons, Reservations, Marketing, Analytics visible     | P1       |
| UI-015 | Active nav item highlighted with green background                  | Current page link has bg-green-50 and green text color                          | P1       |
| UI-016 | Non-active nav items have default styling                          | Slate-600 text, hover shows slate-50 background                                | P3       |
| UI-017 | Logout button visible at sidebar bottom                            | Logout button with icon in bottom border-top section                            | P1       |
| UI-018 | Logout button redirects to /login                                  | Clicking logout signs out and navigates to /login                               | P1       |
| UI-019 | Sidebar logo links to home                                         | Clicking LineMag logo navigates to "/"                                          | P3       |

---

## 3. Manual Broadcast (/dashboard)

| ID     | Description                                                        | Expected Result                                                                 | Priority |
|--------|--------------------------------------------------------------------|---------------------------------------------------------------------------------|----------|
| UI-020 | Step 1 (Fetch): URL input and fetch button displayed               | Text input for article source URL and a "Fetch" action button                   | P1       |
| UI-021 | Step 1: Loading spinner shown during article list fetch            | Spinner SVG animates while API call is in progress                              | P2       |
| UI-022 | Step 1: Article list rendered as cards after fetch                 | ArticleCard components shown with title, thumbnail, and category                | P1       |
| UI-023 | Step 1: Category filter dropdown functional                        | Dropdown filters displayed articles by selected category                        | P2       |
| UI-024 | Step 1: Pagination controls for article list                       | Page navigation appears when articles exceed PAGE_SIZE (10)                     | P2       |
| UI-025 | Step 2 (Select): Article detail loads on selection                 | Clicking an article card fetches and displays detailed info (catchy title, summary) | P1   |
| UI-026 | Step 2: Back button returns to article list                        | Back arrow navigates to previous step without losing list state                 | P2       |
| UI-027 | Step 3 (Template): Template selector displayed                     | TemplateSelector component shows available Flex Message templates               | P1       |
| UI-028 | Step 3: Flex preview renders selected template                     | FlexPreview component shows live preview of the chosen template with article    | P1       |
| UI-029 | Step 4 (Confirm): Delivery mode toggle (broadcast/push)            | Radio or toggle to switch between broadcast and individual push                 | P1       |
| UI-030 | Step 4: Push mode shows follower list and search                   | When push selected, follower list loads with search input                       | P2       |
| UI-031 | Step 4: Send button with loading state                             | Green send button; disabled with spinner during API call                        | P1       |
| UI-032 | Step 4: Test send button available                                 | Separate "Test Send" button for sending to test users                           | P2       |
| UI-033 | Step 4: Success/error message after send                           | Flash message with ok/error status shown post-send                              | P1       |

---

## 4. Schedule (/dashboard/schedule)

| ID     | Description                                                        | Expected Result                                                                 | Priority |
|--------|--------------------------------------------------------------------|---------------------------------------------------------------------------------|----------|
| UI-034 | Page heading and description displayed                             | Title "Schedule Delivery" with subtitle about Vercel Cron                       | P2       |
| UI-035 | Enable/disable toggle switch functional                            | Toggle switches between green (enabled) and slate (disabled) states             | P1       |
| UI-036 | Disabled state dims the settings panel                             | When toggle off, settings area has opacity-50 and pointer-events-none           | P2       |
| UI-037 | Delivery time inputs displayed                                     | Time input fields for each scheduled delivery time                              | P1       |
| UI-038 | Template selector for scheduled delivery                           | Dropdown or selector to choose template from TEMPLATE_DEFINITIONS               | P1       |
| UI-039 | Max articles per run setting                                       | Numeric input for maxArticlesPerRun                                             | P2       |
| UI-040 | Save button with loading state                                     | Button shows "Saving..." when saving, disabled during operation                 | P1       |
| UI-041 | Success message after save                                         | Green flash message "Settings saved" appears after successful save              | P2       |

---

## 5. Delivery History (/dashboard/history)

| ID     | Description                                                        | Expected Result                                                                 | Priority |
|--------|--------------------------------------------------------------------|---------------------------------------------------------------------------------|----------|
| UI-042 | Page heading with refresh button                                   | Title "Delivery History" and a refresh button on the right                      | P2       |
| UI-043 | History table with correct columns                                 | Columns: Title, URL, Template, Status, Sent At                                 | P1       |
| UI-044 | SUCCESS status badge styled in green                               | Green badge for successful deliveries                                           | P2       |
| UI-045 | FAILED status badge styled in red                                  | Red badge for failed deliveries, with error detail expandable                   | P2       |
| UI-046 | Loading state shows spinner                                        | Full-table spinner while history data loads                                     | P2       |
| UI-047 | Empty state when no history exists                                 | Friendly message indicating no delivery history yet                             | P3       |
| UI-048 | Error state when API fails                                         | Red error banner with descriptive message                                       | P2       |

---

## 6. Logs (/dashboard/logs)

| ID     | Description                                                        | Expected Result                                                                 | Priority |
|--------|--------------------------------------------------------------------|---------------------------------------------------------------------------------|----------|
| UI-049 | Step filter dropdown functional                                    | Dropdown with options: All, CRON, SCRAPE, SUMMARIZE, BROADCAST                 | P1       |
| UI-050 | Log entries displayed in table format                              | Columns: Timestamp, Step, Result, Detail                                        | P1       |
| UI-051 | Step badges color-coded                                            | CRON=blue, SCRAPE=purple, SUMMARIZE=amber, BROADCAST=green                     | P3       |
| UI-052 | Result badges color-coded                                          | SUCCESS=green, ERROR=red, SKIP=slate                                            | P3       |
| UI-053 | Metadata expandable/viewable for each log                          | JSON metadata displayed or expandable for entries with metadata                 | P3       |
| UI-054 | Loading and error states                                           | Spinner during load; error banner on failure                                    | P2       |

---

## 7. CRM - Customer List (/dashboard/crm)

| ID     | Description                                                        | Expected Result                                                                 | Priority |
|--------|--------------------------------------------------------------------|---------------------------------------------------------------------------------|----------|
| UI-055 | Page heading shows customer count                                  | Title "Customer List" with "{N} customers" subtitle                             | P1       |
| UI-056 | Search input with icon                                             | Search field with magnifying glass icon, placeholder "Search by name/email..."  | P1       |
| UI-057 | Search debounces at 300ms                                          | Typing pauses 300ms before triggering search; page resets to 1                  | P2       |
| UI-058 | Tier filter dropdown                                               | Select with options: All, Free, Silver, Gold, Platinum                          | P1       |
| UI-059 | Prefecture filter dropdown                                         | Select with 47 prefectures plus default "Prefecture" option                     | P2       |
| UI-060 | Customer table with correct columns                                | Columns: Customer (avatar+name+email), LINE ID, Tier, Messages, Last Seen, Actions | P1   |
| UI-061 | Avatar displays profile image or initials fallback                 | Image shown if URL exists; green circle with initial letter otherwise           | P2       |
| UI-062 | Tier badge color-coded per tier                                    | Free=slate, Silver=blue, Gold=amber, Platinum=purple                           | P3       |
| UI-063 | Relative time formatting for last seen                             | Shows "just now", "N min ago", "N hours ago", "N days ago" etc.                | P3       |
| UI-064 | Detail link button in actions column                               | Green "Detail" button linking to /dashboard/crm/{id}                           | P1       |
| UI-065 | Pagination controls when total > 20                                | Previous/Next buttons and numbered page buttons with active highlighting        | P1       |
| UI-066 | Pagination shows range text                                        | Displays "1 - 20 / 150 items" format                                           | P3       |
| UI-067 | Loading state with spinner in table                                | Centered spinner in table body during data fetch                                | P2       |
| UI-068 | Empty state when no customers match filters                        | Message "No matching customers found" displayed                                 | P2       |
| UI-069 | Error state when API fails                                         | Red error banner above table with error message                                 | P2       |

---

## 8. CRM - Customer Detail (/dashboard/crm/[id])

| ID     | Description                                                        | Expected Result                                                                 | Priority |
|--------|--------------------------------------------------------------------|---------------------------------------------------------------------------------|----------|
| UI-070 | Breadcrumb link back to customer list                              | Green "Back to customer list" link with left arrow icon                         | P2       |
| UI-071 | Profile header with avatar, name, tier badge                       | Large avatar (64px), display name, tier badge, LINE ID, first/last seen dates  | P1       |
| UI-072 | Two-column layout on desktop (2/3 + 1/3)                           | Left column: profile + info + activity; Right column: tags + stats             | P1       |
| UI-073 | Single-column layout on mobile                                     | Columns stack vertically on screens < lg breakpoint                            | P2       |
| UI-074 | Editable basic info form (email, phone, gender, DOB, prefecture)   | Five form fields pre-populated with customer data                               | P1       |
| UI-075 | Save button with loading and success states                        | Button shows "Saving..." during save; success message "Saved" appears          | P1       |
| UI-076 | Tags card displays existing tags as pills                          | Green pill badges with X button for each tag                                    | P1       |
| UI-077 | Tag add form with input and submit button                          | Text input with "Add" button; new tag appears in list on success               | P1       |
| UI-078 | Tag remove button functional                                       | Clicking X on tag removes it; loading state disables buttons                   | P2       |
| UI-079 | Activity timeline with icons and relative time                     | Vertical timeline with action-type icons, labels, and timestamps               | P1       |
| UI-080 | Empty activity state                                               | Message "No activity yet" when actions list is empty                            | P3       |
| UI-081 | Stats card with message count, action count, registration date     | Three stat rows with labels and values                                          | P2       |
| UI-082 | Custom attributes card (conditional)                               | Only shown when customer has attributes; key-value pairs listed                 | P3       |
| UI-083 | Loading spinner while data loads                                   | Full-page centered spinner during initial load                                  | P2       |
| UI-084 | Error state with back link                                         | Error banner with back link when customer not found or API fails               | P2       |

---

## 9. Segments (/dashboard/crm/segments)

| ID     | Description                                                        | Expected Result                                                                 | Priority |
|--------|--------------------------------------------------------------------|---------------------------------------------------------------------------------|----------|
| UI-085 | Page heading with "New Segment" button                             | Title "Segment Management" with green "New Segment" button on right            | P1       |
| UI-086 | Segment list table with correct columns                            | Columns: Name+Description, Type, Member Count, Last Computed, Created, Actions | P1       |
| UI-087 | Type badge: static=blue, dynamic=purple                            | Color-coded badges for segment type                                             | P3       |
| UI-088 | Row click opens detail panel                                       | Clicking a segment row opens inline detail panel above table                   | P1       |
| UI-089 | Detail panel shows segment metadata                                | Type, member count, last computed date, created date displayed in grid          | P2       |
| UI-090 | Dynamic segment shows rules in JSON pre block                      | Formatted JSON displayed in code block with scroll                              | P3       |
| UI-091 | Member management button (static segments only)                    | "Member Management" button appears only for static type segments               | P2       |
| UI-092 | Member list table with ID, name, email                             | Table rendered after clicking member management                                 | P2       |
| UI-093 | Add members form with comma-separated IDs                          | Text input for customer IDs and "Add" button                                    | P2       |
| UI-094 | Create segment modal opens correctly                               | Modal overlay with form: name (required), description, type radio, rules       | P1       |
| UI-095 | Edit segment modal pre-fills existing data                         | Modal fields populated with selected segment data                               | P1       |
| UI-096 | Delete confirmation modal                                          | Modal with warning text and Cancel/Delete buttons                               | P1       |
| UI-097 | Delete button styled in red                                        | Red background delete button; loading state shows "Deleting..."                | P2       |
| UI-098 | Flash messages for CRUD operations                                 | Green banner with close button for success; error messages displayed           | P2       |
| UI-099 | Empty state when no segments exist                                 | Prompt message encouraging creation of first segment                            | P3       |

---

## 10. Coupons - List (/dashboard/coupons)

| ID     | Description                                                        | Expected Result                                                                 | Priority |
|--------|--------------------------------------------------------------------|---------------------------------------------------------------------------------|----------|
| UI-100 | Coupon list displays all coupons in card or table format           | Each coupon shows: name, code, discount type badge, discount value, status     | P1       |
| UI-101 | Discount type badges color-coded                                   | Fixed=blue, Percentage=purple, Free Shipping=amber                              | P3       |
| UI-102 | Status badges: active=green, expired=red, inactive=slate           | Correct status computed from isActive flag and validUntil date                 | P1       |
| UI-103 | Link to coupon detail page                                         | Each coupon links to /dashboard/coupons/{id}                                    | P1       |
| UI-104 | Link to create new coupon                                          | Navigation to /dashboard/coupons/new                                            | P1       |
| UI-105 | Loading and error states                                           | Spinner during load; error message on API failure                               | P2       |

---

## 11. Coupons - Create (/dashboard/coupons/new)

| ID     | Description                                                        | Expected Result                                                                 | Priority |
|--------|--------------------------------------------------------------------|---------------------------------------------------------------------------------|----------|
| UI-106 | Form displays all required fields                                  | Code, name, description, discount type, value, min purchase, max issues, dates | P1       |
| UI-107 | Discount type selector (fixed/percentage/free_shipping)            | Radio or select input; free_shipping hides discount value field                 | P1       |
| UI-108 | Field-level validation errors displayed                            | Red text below each field showing specific validation message                   | P1       |
| UI-109 | Percentage validation caps at 100                                  | Error shown if percentage value exceeds 100                                     | P2       |
| UI-110 | Submit button with loading state                                   | Button disabled with spinner during form submission                             | P1       |
| UI-111 | Global error message on API failure                                | Error banner at top of form on submission failure                               | P2       |
| UI-112 | Successful creation redirects to coupon list                       | After successful POST, user navigated to /dashboard/coupons                    | P1       |

---

## 12. Coupons - Detail (/dashboard/coupons/[id])

| ID     | Description                                                        | Expected Result                                                                 | Priority |
|--------|--------------------------------------------------------------------|---------------------------------------------------------------------------------|----------|
| UI-113 | Coupon master info card displayed                                  | Name, code, discount details, validity dates, active status shown              | P1       |
| UI-114 | Coupon stats summary (issued, used, revoked, expired)              | Four stat numbers shown in grid or cards                                        | P1       |
| UI-115 | Issued coupons table                                               | Columns: Issue Code, Customer, Status, Issued At, Used At                      | P1       |
| UI-116 | Status badges for issued coupons                                   | Active=green, Used=blue, Revoked=red, Expired=slate                            | P2       |
| UI-117 | Issue coupon to customer action                                    | Customer search/select and issue button with loading state                      | P1       |
| UI-118 | Back link to coupon list                                           | Breadcrumb or back link to /dashboard/coupons                                   | P2       |

---

## 13. Reservations - List (/dashboard/reservations)

| ID     | Description                                                        | Expected Result                                                                 | Priority |
|--------|--------------------------------------------------------------------|---------------------------------------------------------------------------------|----------|
| UI-119 | Stats cards at top (today, this week, this month, cancel rate)     | Four KPI cards with numerical values                                            | P1       |
| UI-120 | Filter bar: status, date from, date to, consultant                 | Four filter controls in a row; consultant dropdown populated from API          | P1       |
| UI-121 | Reservation table with correct columns                             | Columns include: Customer, Service, Date, Time, Consultant, Status, Actions    | P1       |
| UI-122 | Status badges with correct colors                                  | Confirmed=blue, Completed=green, Cancelled=slate, No Show=red                  | P2       |
| UI-123 | Action buttons per reservation row                                 | Status update actions (complete, cancel) with loading indicators               | P2       |
| UI-124 | Loading and error states                                           | Spinner during data load; error banner on failure                               | P2       |
| UI-125 | Empty state when no reservations match filters                     | Informational message when filter returns zero results                          | P3       |

---

## 14. Reservations - Calendar (/dashboard/reservations/calendar)

| ID     | Description                                                        | Expected Result                                                                 | Priority |
|--------|--------------------------------------------------------------------|---------------------------------------------------------------------------------|----------|
| UI-126 | Monthly calendar grid with Mon-Sun headers                         | 6-week grid starting from Monday; Japanese day name headers                    | P1       |
| UI-127 | Month navigation (previous/next)                                   | Arrow buttons to navigate between months; year/month label updates             | P1       |
| UI-128 | Today highlighted in calendar                                      | Current date cell has distinct background or border                             | P2       |
| UI-129 | Reservation dots on calendar cells                                 | Colored dots per status on days with reservations                               | P1       |
| UI-130 | Click on date opens side panel                                     | Side panel shows list of reservations for the selected date                    | P1       |
| UI-131 | Side panel shows reservation details                               | Each reservation: customer name, time, service type, status badge              | P2       |
| UI-132 | Status action buttons in side panel                                | Complete/Cancel buttons per reservation with loading state                      | P2       |
| UI-133 | Loading state during data fetch                                    | Spinner overlay or skeleton while calendar data loads                           | P2       |

---

## 15. Reservations - Slot Settings (/dashboard/reservations/slots)

| ID     | Description                                                        | Expected Result                                                                 | Priority |
|--------|--------------------------------------------------------------------|---------------------------------------------------------------------------------|----------|
| UI-134 | Business hours configuration per weekday                           | Mon-Fri rows with start/end time inputs                                         | P1       |
| UI-135 | Slot duration settings                                             | Input or selector for slot duration in minutes (e.g., 30)                      | P1       |
| UI-136 | Buffer minutes setting                                             | Numeric input for buffer time between appointments                              | P2       |
| UI-137 | Bookable ahead days setting                                        | Numeric input for how many days ahead bookings are allowed                      | P2       |
| UI-138 | Closed dates management                                            | Add/remove specific closed dates with date picker                               | P2       |
| UI-139 | Consultant management section                                      | List of consultants with name, email, meet URL, specialties, active toggle     | P1       |
| UI-140 | Save settings button with loading state                            | Primary green button; disabled during save operation                            | P1       |

---

## 16. MA - Scenarios (/dashboard/ma)

| ID     | Description                                                        | Expected Result                                                                 | Priority |
|--------|--------------------------------------------------------------------|---------------------------------------------------------------------------------|----------|
| UI-141 | Scenario list with name, trigger type, status, stats               | Table or card list showing all scenarios                                        | P1       |
| UI-142 | Trigger type badges color-coded                                    | Event=blue, Schedule=purple, Manual=amber                                       | P3       |
| UI-143 | Active/inactive toggle per scenario                                | Toggle switch to enable/disable each scenario                                   | P1       |
| UI-144 | Stats display (sent, opened, clicked)                              | Three metrics shown per scenario                                                | P2       |
| UI-145 | Create new scenario button/modal                                   | Button opens form with: name, description, trigger type, trigger config        | P1       |
| UI-146 | Event type selector when trigger=event                             | Dropdown with: Friend Added, Purchase, Reservation, Birthday, Inactive 30d    | P1       |
| UI-147 | Target segment selector                                            | Dropdown populated from segments API                                            | P2       |
| UI-148 | Scenario steps builder                                             | Ordered list of steps: wait, message, condition, coupon, tag                   | P1       |
| UI-149 | Step type icons and labels                                         | Each step type has color-coded icon and Japanese label                          | P3       |
| UI-150 | Add/remove/reorder steps                                           | Controls to manage the step sequence                                            | P2       |

---

## 17. MA - A/B Tests (/dashboard/ma/ab-tests)

| ID     | Description                                                        | Expected Result                                                                 | Priority |
|--------|--------------------------------------------------------------------|---------------------------------------------------------------------------------|----------|
| UI-151 | A/B test list with status, type, dates                             | Table showing all tests with status badges                                      | P1       |
| UI-152 | Status badges: draft=slate, running=blue, completed=green, stopped=red | Correct color mapping per status                                            | P2       |
| UI-153 | Test type labels in Japanese                                       | Template, Content, Send Time, Subject displayed correctly                      | P3       |
| UI-154 | Variant comparison display (A vs B)                                | Side-by-side metrics: delivered, opened, clicked, converted                    | P1       |
| UI-155 | Winner indicator                                                   | Winner badge (A or B) shown when test is completed and significant             | P2       |
| UI-156 | Statistical significance indicator                                 | Badge or text showing whether result is statistically significant              | P2       |
| UI-157 | Create new A/B test form                                           | Form with: name, description, test type, variants, segment, sample size, metric | P1      |
| UI-158 | Start/Stop test action buttons                                     | Contextual buttons based on test status (Start for draft, Stop for running)    | P1       |

---

## 18. Analytics - Dashboard (/dashboard/analytics)

| ID     | Description                                                        | Expected Result                                                                 | Priority |
|--------|--------------------------------------------------------------------|---------------------------------------------------------------------------------|----------|
| UI-159 | Period selector (Today, 7d, 30d, 90d, Custom)                     | Button group or tabs for period selection; Custom shows date pickers           | P1       |
| UI-160 | KPI cards: delivery count, open rate, total customers, bookings    | Four summary cards with values and change percentages                          | P1       |
| UI-161 | Change percentage shown with up/down indicator                     | Positive changes in green, negative in red, with arrow icons                   | P2       |
| UI-162 | Delivery trend chart/sparkline                                     | Visual trend line for delivery counts over selected period                      | P2       |
| UI-163 | Customer trend chart/sparkline                                     | Visual trend line for customer growth over selected period                      | P2       |
| UI-164 | Coupon summary (issued vs used)                                    | Two metrics shown in a card or mini-chart                                       | P2       |
| UI-165 | Booking summary (week total, cancel rate)                          | Two metrics shown in a card                                                     | P2       |
| UI-166 | Sub-navigation links to detail pages                               | Links: Delivery Analysis, Customer Analysis, Coupon Analysis, Booking Analysis, Reports | P1 |
| UI-167 | Loading state during KPI data fetch                                | Skeleton or spinner placeholders while data loads                               | P2       |
| UI-168 | Custom date range picker functionality                             | From/To date inputs appear when "Custom" period selected                       | P2       |

---

## 19. Analytics - Delivery (/dashboard/analytics/delivery)

| ID     | Description                                                        | Expected Result                                                                 | Priority |
|--------|--------------------------------------------------------------------|---------------------------------------------------------------------------------|----------|
| UI-169 | KPI row: total sent, open rate, click rate, failure rate           | Four metric cards with formatted values                                         | P1       |
| UI-170 | Daily trend chart (sent, opened, clicked)                          | Multi-series chart or table showing daily breakdown                             | P2       |
| UI-171 | Delivery type breakdown                                            | Pie/bar chart: Broadcast, Push, Scenario, A/B Test with counts                 | P2       |
| UI-172 | Recent deliveries table                                            | Date, Type, Template, Status badge, Count columns                              | P1       |
| UI-173 | Status badges: success=green, failed=red, partial=amber            | Correct color mapping per delivery status                                       | P3       |

---

## 20. Analytics - Reports (/dashboard/analytics/reports)

| ID     | Description                                                        | Expected Result                                                                 | Priority |
|--------|--------------------------------------------------------------------|---------------------------------------------------------------------------------|----------|
| UI-174 | Report type selector                                               | Dropdown: Delivery, Customer, Coupon, Reservation, Summary                     | P1       |
| UI-175 | Date range inputs (from/to)                                        | Two date pickers for report period; defaults to current month                  | P1       |
| UI-176 | Generate report button with loading state                          | Button triggers API call; spinner during generation                             | P1       |
| UI-177 | Report summary section                                             | Total records and aggregated metrics displayed                                  | P2       |
| UI-178 | Report data table with dynamic columns                             | Table rendered from columns/rows API response                                   | P1       |
| UI-179 | Export as CSV button                                               | Downloads CSV file with report data                                             | P1       |
| UI-180 | Export as JSON button                                              | Downloads JSON file with report data                                            | P3       |
| UI-181 | Empty state when no data in range                                  | Message indicating no data for selected period                                  | P3       |

---

## 21. LIFF - Booking Flow (/liff/booking)

| ID     | Description                                                        | Expected Result                                                                 | Priority |
|--------|--------------------------------------------------------------------|---------------------------------------------------------------------------------|----------|
| UI-182 | Step indicator showing 4 steps                                     | Progress bar/stepper: Service Select, Date Select, Time Select, Confirm        | P1       |
| UI-183 | Step 1: Service type cards displayed                               | Three cards: General (30min), Technical (60min), Career (60min) with icons     | P1       |
| UI-184 | Step 1: Card selection highlights chosen service                   | Selected card has distinct border/background color                              | P2       |
| UI-185 | Step 2: Date grid with available dates                             | Calendar or date list showing next N bookable days                              | P1       |
| UI-186 | Step 2: Weekends and holidays marked/disabled                      | Saturday, Sunday, and predefined holidays visually distinguished               | P2       |
| UI-187 | Step 2: Available slot count shown per date                        | Number badge showing how many slots are available each day                      | P2       |
| UI-188 | Step 3: Time slot list for selected date                           | Time slots with start-end time and consultant name                              | P1       |
| UI-189 | Step 3: Slot selection highlights chosen time                      | Selected slot has green border/background                                       | P2       |
| UI-190 | Step 4: Confirmation summary                                       | Service type, date, time, consultant displayed for review                      | P1       |
| UI-191 | Step 4: Submit reservation button                                  | Green "Confirm Reservation" button with loading state                          | P1       |
| UI-192 | Step 4: Success result with meeting URL                            | After booking, shows confirmation with Google Meet URL link                    | P1       |
| UI-193 | Mobile-optimized layout throughout                                 | Full-width cards, touch-friendly tap targets (min 44px)                        | P1       |

---

## 22. LIFF - My Coupons (/liff/coupons)

| ID     | Description                                                        | Expected Result                                                                 | Priority |
|--------|--------------------------------------------------------------------|---------------------------------------------------------------------------------|----------|
| UI-194 | Tab switcher: Available / Used                                     | Two tabs filtering coupon list by status                                        | P1       |
| UI-195 | Coupon cards with discount display                                 | Each card shows: main discount value, type label, coupon name                  | P1       |
| UI-196 | Discount formatting (yen/percent/free shipping)                    | Fixed shows yen symbol, percentage shows %, free shipping shows text           | P2       |
| UI-197 | Expiry date displayed on each coupon                               | Formatted date showing validity period                                          | P2       |
| UI-198 | Copy coupon code functionality                                     | Tap to copy; visual feedback showing "Copied" state                            | P2       |
| UI-199 | Loading state with spinner                                         | Centered spinner while coupons load                                             | P2       |
| UI-200 | Empty state per tab                                                | "No available coupons" / "No used coupons" messages                            | P3       |
| UI-201 | Error state on API failure                                         | Error message displayed when coupon fetch fails                                 | P2       |

---

## 23. LIFF - My Page (/liff/mypage)

| ID     | Description                                                        | Expected Result                                                                 | Priority |
|--------|--------------------------------------------------------------------|---------------------------------------------------------------------------------|----------|
| UI-202 | Profile header with avatar and name                                | User avatar (or fallback initial), display name, LINE ID shown                 | P1       |
| UI-203 | Menu cards with icons and descriptions                             | Three cards: Book Appointment, My Coupons, Reservation History                 | P1       |
| UI-204 | Menu card links navigate correctly                                 | Booking -> /liff/booking, Coupons -> /liff/coupons, History -> /liff/reservations | P1     |
| UI-205 | Color-coded icons per menu item                                    | Booking=blue, Coupons=green, History=purple background tints                   | P3       |
| UI-206 | Mobile-first responsive layout                                     | Full-width layout optimized for mobile viewport                                 | P1       |

---

## 24. Preview Page (/preview)

| ID     | Description                                                        | Expected Result                                                                 | Priority |
|--------|--------------------------------------------------------------------|---------------------------------------------------------------------------------|----------|
| UI-207 | Flex Message preview rendered                                      | Visual preview of LINE Flex Message template                                    | P2       |
| UI-208 | Template switching functionality                                   | Ability to switch between different template previews                           | P3       |

---

## 25. Cross-cutting UI/UX Concerns

| ID     | Description                                                        | Expected Result                                                                 | Priority |
|--------|--------------------------------------------------------------------|---------------------------------------------------------------------------------|----------|
| UI-209 | Responsive design: 320px viewport                                  | All pages render without horizontal scroll on 320px width                      | P1       |
| UI-210 | Responsive design: 768px viewport (tablet)                         | Sidebar transitions from hidden to visible at md breakpoint                    | P1       |
| UI-211 | Responsive design: 1920px viewport (large desktop)                 | Content area respects max-w-5xl constraint; no excess stretching               | P2       |
| UI-212 | Japanese text rendering across all pages                           | All Japanese labels, placeholders, and messages render without tofu/fallback   | P1       |
| UI-213 | Error state UI consistency                                         | All error banners use same style: red-50 bg, red-700 text, red-200 border     | P2       |
| UI-214 | Loading state UI consistency                                       | All spinners use same SVG pattern with animate-spin class                      | P2       |
| UI-215 | Empty state UI consistency                                         | All empty states use centered text in slate-400 with encouraging copy          | P3       |
| UI-216 | Button disabled states consistent                                  | All disabled buttons have opacity-50 and cursor-not-allowed                    | P2       |
| UI-217 | Focus ring consistency on form inputs                              | All inputs show green-500 focus ring on focus (ring-2)                         | P3       |
| UI-218 | Hover transitions consistent                                       | All interactive elements use transition-colors for smooth hover effects        | P3       |
| UI-219 | Form labels consistent styling                                     | All labels use text-xs font-medium text-slate-600 or text-slate-500           | P3       |
| UI-220 | Card/panel border radius consistency                               | Dashboard cards use rounded-2xl; modals use rounded-xl                         | P3       |
| UI-221 | Modal overlay pattern consistency                                  | All modals use fixed inset-0 with bg-black/30 backdrop                         | P2       |
| UI-222 | Flash message dismiss functionality                                | Flash messages either auto-dismiss or have close button                        | P3       |
| UI-223 | Keyboard navigation on forms                                       | Tab order follows visual layout; Enter submits forms                           | P2       |
| UI-224 | ARIA labels on icon-only buttons                                   | Hamburger menu, tag remove, and other icon buttons have aria-label             | P2       |
| UI-225 | Badge/pill consistency                                              | All status badges use rounded-full with px-2 py-0.5 text-xs font-medium      | P3       |
| UI-226 | Table header styling consistency                                   | All table headers use uppercase tracking-wider text-xs font-semibold          | P3       |
| UI-227 | Page title hierarchy consistency                                   | All pages use text-xl font-bold for h1; text-sm text-slate-400 for subtitle   | P2       |
| UI-228 | Green color theme consistency                                      | Primary actions use green-600 bg; active states use green-50/green-700        | P2       |
| UI-229 | Sidebar scroll behavior                                            | Nav section scrolls independently when content overflows                       | P3       |
| UI-230 | Mobile tap target minimum size                                     | All interactive elements meet minimum 44x44px touch target on mobile          | P2       |

---

## Test Case Summary

| Section                          | ID Range      | Count |
|----------------------------------|---------------|-------|
| Login Page                       | UI-001 - 009  |     9 |
| Dashboard Layout                 | UI-010 - 019  |    10 |
| Manual Broadcast                 | UI-020 - 033  |    14 |
| Schedule                         | UI-034 - 041  |     8 |
| Delivery History                 | UI-042 - 048  |     7 |
| Logs                             | UI-049 - 054  |     6 |
| CRM - Customer List              | UI-055 - 069  |    15 |
| CRM - Customer Detail            | UI-070 - 084  |    15 |
| Segments                         | UI-085 - 099  |    15 |
| Coupons - List                   | UI-100 - 105  |     6 |
| Coupons - Create                 | UI-106 - 112  |     7 |
| Coupons - Detail                 | UI-113 - 118  |     6 |
| Reservations - List              | UI-119 - 125  |     7 |
| Reservations - Calendar          | UI-126 - 133  |     8 |
| Reservations - Slot Settings     | UI-134 - 140  |     7 |
| MA - Scenarios                   | UI-141 - 150  |    10 |
| MA - A/B Tests                   | UI-151 - 158  |     8 |
| Analytics - Dashboard            | UI-159 - 168  |    10 |
| Analytics - Delivery             | UI-169 - 173  |     5 |
| Analytics - Reports              | UI-174 - 181  |     8 |
| LIFF - Booking                   | UI-182 - 193  |    12 |
| LIFF - Coupons                   | UI-194 - 201  |     8 |
| LIFF - My Page                   | UI-202 - 206  |     5 |
| Preview Page                     | UI-207 - 208  |     2 |
| Cross-cutting                    | UI-209 - 230  |    22 |
|----------------------------------|---------------|-------|
| **Total**                        |               | **230** |

---

## Priority Distribution

| Priority | Count | Description                              |
|----------|-------|------------------------------------------|
| P1       |   93  | Critical -- must pass for release        |
| P2       |   96  | Important -- should pass for release     |
| P3       |   41  | Nice-to-have -- cosmetic/polish checks   |
