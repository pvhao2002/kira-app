# PROMPT: BUILD AI FOOTBALL PREDICTION MANAGEMENT SYSTEM

## 1. ROLE & OBJECTIVE

You are a Senior Full-Stack Software Engineer, Software Architect, Database Architect, and UI/UX Designer.

Your task is to design, implement, test, and deliver a complete, production-ready **AI Football Prediction Management System**.

The system receives football predictions from external AI Models through secure callback APIs, stores match information, betting odds, live statistics, Monte Carlo simulations, predictions, actual match results, and calculates prediction outcomes.

The application must provide a modern management dashboard, comprehensive reports, AI performance tracking, and editable AI prompt templates.

**IMPORTANT REQUIREMENTS:**

- Implement the entire application, not just a prototype.
- Do not stop after scaffolding or generating sample pages.
- Do not leave TODOs, placeholder functionality, mock APIs, or unfinished features.
- All frontend functionality must be connected to working backend APIs.
- All data must be persisted in PostgreSQL.
- Use clean architecture, reusable components, and maintainable code.
- Validate all incoming data and handle errors properly.
- Continue implementing, reviewing, debugging, and testing until all requirements are satisfied.
- Do not claim the application is bug-free without executing the relevant tests.
- If a requirement is ambiguous, make a reasonable engineering decision and document it.

---

## 2. TECHNOLOGY STACK

### Frontend

- Angular (latest stable compatible version)
- TypeScript
- Native HTML elements plus a small in-house UI kit (no component library; PrimeNG 20.x+ requires a PrimeTek licence key)
- PrimeIcons
- Angular Reactive Forms
- Angular Router
- Angular HttpClient
- Apache ECharts or another suitable charting library

Frontend requirements:

- Use Angular standalone components.
- Use lazy-loaded routes.
- Use reusable components.
- Use strongly typed interfaces.
- Use a centralized API service layer.
- Use HTTP interceptors for authentication and error handling.
- Implement route guards.
- Support responsive layouts.
- Use the shared UI kit components consistently.

### Backend

- Java 25
- Spring Boot (latest stable version compatible with Java 25)
- Spring Security
- Spring Data JPA
- Hibernate
- Jakarta Bean Validation
- Flyway Database Migration
- Spring Boot Actuator
- OpenAPI / Swagger
- Maven

Backend architecture:

Controller → Service → Repository → PostgreSQL

Use DTOs, validation, centralized exception handling, structured logging, and database transactions.

### Database

- PostgreSQL
- UUID primary keys
- TIMESTAMPTZ
- JSONB
- NUMERIC for odds and probabilities
- Flyway migrations
- Proper indexes and constraints

### Deployment

- Docker
- Docker Compose
- Environment-based configuration
- Separate frontend and backend services
- PostgreSQL persistent volume
- Health checks

---

## 3. DATABASE DESIGN

Use the existing AI Football Prediction PostgreSQL DDL as the starting point.

Review, improve, and update the entire schema to support all requirements.

Do not remove existing functionality.

### Required tables

1. providers
2. ai_models
3. matches
4. predictions
5. prediction_odds
6. prediction_stats
7. prediction_simulations
8. prediction_picks
9. prediction_correct_scores
10. prediction_pick_results
11. users
12. prompt_templates
13. external_api_requests

Additional tables may be created when necessary.

### Database requirements

#### Providers

Store external provider information, API credentials, status, and timestamps.

Store only securely hashed API credentials.

#### AI Models

Store model name, version, provider, and timestamps.

Support multiple AI Models per provider.

#### Matches

Store:

- External match ID
- Provider
- League
- Home team
- Away team
- Match start time
- Match status
- Final home score
- Final away score
- Final home corners
- Final away corners
- Half-time scores when available
- Half-time corners when available
- Created and updated timestamps

Supported statuses:

- SCHEDULED
- LIVE
- FINISHED
- CANCELLED
- POSTPONED

#### Predictions

Store:

- Match
- AI Model
- External event ID
- Prediction type: PRE_MATCH / LIVE
- Match minute
- Current home score
- Current away score
- Prediction timestamp
- Original callback payload
- Additional prediction metadata

Every prediction must preserve its original historical snapshot.

Do not overwrite historical predictions when new predictions arrive.

#### Prediction Odds

Supported markets:

- 1X2
- Asian Handicap (AH)
- Over/Under (OU)
- Corner Asian Handicap (CORNER_AH)
- Corner Over/Under (CORNER_OU)

Supported odds stages:

- OPENING
- PRE_MATCH
- LIVE

Store:

- Market
- Odds stage
- Snapshot order
- Handicap/total line
- Original line display
- Home odds
- Away odds
- Draw odds
- Over odds
- Under odds
- Settlement basis
- Match score at odds capture
- Corner score at odds capture
- Capture timestamp
- Additional JSONB data

Support multiple odds snapshots with the same market, stage, and line when they represent distinct observations.

Preserve the original provider odds values.

**Corner is OPTIONAL.**

If the provider does not send Corner data, do not generate fake Corner records.

#### Prediction Stats

Store available live match statistics:

- Possession
- Shots
- Shots on target
- Shots off target
- Corners
- Yellow cards
- Red cards
- Additional statistics in JSONB

Stats are optional.

Do not fabricate missing statistics.

#### Prediction Simulations

Support Monte Carlo simulation metadata:

- Simulation method
- Number of simulations, default 1000
- Random seed
- Expected remaining home goals
- Expected remaining away goals
- Expected remaining home corners
- Expected remaining away corners
- Algorithm version
- Simulation parameters
- Probability distributions
- Correct-score distributions

Store enough information to audit the calculation and reproduce it when the algorithm supports deterministic replay.

#### Prediction Picks

Store:

- Prediction
- Referenced odds snapshot
- Market
- Pick
- Win probability
- Pick rank

Supported picks:

- HOME
- DRAW
- AWAY
- OVER
- UNDER

Support ranking the top two predictions with the highest estimated winning probability.

Ensure each pick references the correct odds and prediction.

#### Prediction Correct Scores

Store the predicted final score:

- Predicted home score
- Predicted away score
- Probability

The predicted score always represents the final match score, not merely additional goals after the live prediction.

#### Prediction Pick Results

Create a dedicated settlement table.

Store:

- Prediction pick
- Settlement result
- Settlement timestamp
- Settlement calculation details
- Settlement source
- Calculation version

Supported results:

- WIN
- LOSS
- HALF_WIN
- HALF_LOSS
- PUSH
- VOID
- PENDING

For reporting:

- HALF_WIN counts as WIN.
- HALF_LOSS counts as LOSS.
- PUSH and VOID are excluded from win-rate calculations.
- Preserve the original settlement result in the database.

#### Users

Implement user authentication without public registration.

Store:

- Username
- Password hash
- Role
- Account status
- Last login
- Created timestamp
- Updated timestamp

Passwords must be hashed securely.

Provide an initial admin account through a secure configuration or initialization process.

Never hardcode production credentials.

#### Prompt Templates

Store editable AI prompt templates.

Required template types:

- AI_PREDICTION
- AI_SETTLEMENT

Store:

- Template name
- Template type
- Content
- Description
- Version
- Active status
- Created timestamp
- Updated timestamp

Support future template types.

#### External API Requests

Store callback audit information:

- Provider
- Request ID
- Event ID
- API endpoint
- Request status
- Processing result
- Error message
- Received timestamp
- Processing duration

Avoid logging API secrets or sensitive authentication headers.

### Database constraints

- Use foreign keys.
- Use appropriate unique constraints.
- Prevent duplicate callback processing.
- Prevent cross-provider data association.
- Prevent odds referencing incorrect predictions.
- Use database transactions.
- Create indexes for frequently queried fields.
- Avoid redundant indexes.
- Use Flyway migrations.
- Never use Hibernate automatic schema modification in production.

---

## 4. AUTHENTICATION & AUTHORIZATION

Implement a complete login system.

### Login Page

- Username
- Password
- Login button
- Validation messages
- Loading state
- Authentication error handling

No registration page.

No public registration API.

### Authentication

Use Spring Security.

Implement secure session-based authentication or a carefully designed JWT authentication mechanism.

Requirements:

- Protected frontend routes
- Protected backend APIs
- Logout
- Session expiration handling
- Unauthorized request handling
- Password hashing
- Secure credential storage
- Appropriate CSRF/CORS protections
- Rate limiting for login attempts

All management APIs require authentication.

External callback APIs must use separate machine-to-machine authentication.

---

## 5. EXTERNAL AI CALLBACK API

Create secure external APIs that allow authorized AI integrations to submit data.

**Only authenticated and authorized AI integrations may submit callback data.**

Do not rely on User-Agent headers, model names, or request payload fields to identify AI callers.

Use provider-specific API keys or equivalent machine-to-machine credentials.

Validate provider identity, permissions, and active status.

### API 1: Insert AI Prediction

POST /api/v1/external/predictions

The API must support:

- AI Model information
- Match information
- League
- Match start time
- Current match score
- Match minute
- Prediction type
- Opening odds
- Pre-match odds
- Live odds
- 1X2
- AH
- OU
- Optional Corner odds
- Optional live statistics
- Monte Carlo simulation metadata
- AI prediction picks
- Predicted correct score
- Probability values

Processing:

1. Authenticate external caller.
2. Validate payload.
3. Validate provider and AI Model relationship.
4. Check idempotency.
5. Upsert match.
6. Resolve AI Model.
7. Insert prediction.
8. Insert odds snapshots.
9. Insert optional statistics.
10. Insert simulation metadata.
11. Insert prediction picks.
12. Insert predicted correct score.
13. Commit transaction.
14. Return prediction ID.

Use atomic transactions.

Support retries without creating duplicate predictions.

Return clear validation errors.

### API 2: Insert / Update Match Results

POST /api/v1/external/matches/results

Support:

- Provider match ID
- Final score
- Final Corner score
- Match status
- Half-time results when available
- Result timestamp

Rules:

- Match results must come from authorized sources.
- Validate match ownership.
- Update actual match results.
- Do not overwrite historical predictions.
- Prevent invalid score values.
- Support idempotent updates.
- Track result changes for auditing.
- Do not settle cancelled or postponed matches as normal completed matches.

### API 3: Calculate Prediction Results

POST /api/v1/external/predictions/settle

Calculate or validate betting outcomes based on:

- Original prediction
- Selected odds
- Odds line
- Settlement basis
- Match score at prediction/odds capture
- Final match score
- Corner score at capture
- Final Corner score

Support:

- 1X2
- AH
- OU
- CORNER_AH
- CORNER_OU

Settlement must correctly handle:

- Full-time markets
- Remaining-match live markets
- Asian quarter lines
- WIN
- LOSS
- HALF_WIN
- HALF_LOSS
- PUSH
- VOID

Never assume live AH starts from 0-0.

Use the correct settlement basis and match score snapshot.

Do not settle a pick if required final results or market rules are missing.

The backend must be the authoritative settlement engine.

External AI may request settlement or submit calculation details, but must not be allowed to override verified settlement results without an explicitly authorized administrative workflow.

Also provide an authenticated internal settlement endpoint for administrators.

Settlement calculations must be deterministic, idempotent, and unit-tested.

---

## 6. FRONTEND APPLICATION

Create a modern, professional, visually polished management application.

### Design requirements

- Modern SaaS dashboard style
- Beautiful, consistent color palette
- Light theme as default
- Clean typography
- Shared in-house UI kit components
- Responsive layout
- Professional spacing
- Clear visual hierarchy
- Consistent cards and tables
- Appropriate icons
- Smooth, subtle transitions
- Loading skeletons
- Empty states
- Error states
- Toast notifications

Use a sidebar layout with top navigation.

Sidebar should support collapse/expand.

### Main navigation

1. Dashboard
2. Matches
3. Predictions
4. AI Models
5. Reports
6. Prompt Notes
7. Providers
8. API Logs
9. Settings

---

## 7. DASHBOARD PAGE

Build a comprehensive dashboard.

Display:

- Total matches
- Total predictions
- Total AI Models
- Total settled picks
- Total wins
- Total losses
- Overall win rate
- Pending settlements
- Predictions today
- Recent predictions

Charts:

- Win rate over time
- Predictions by AI Model
- Predictions by market
- Win/Loss distribution
- AI Model performance comparison

Filters:

- Date range
- League
- AI Model
- Prediction type
- Market

Dashboard statistics must be calculated from real database data.

---

## 8. MATCHES PAGE

Implement a searchable, filterable matches table.

Columns:

- League
- Home team
- Away team
- Start time
- Status
- Final score
- Final Corner score
- Number of predictions
- Actions

Features:

- Search
- Sorting
- Filtering
- Pagination
- Match detail view
- Predictions associated with each match
- Actual result display

### Match Detail

Display:

- Match information
- Match status
- Final result
- Corner result
- Prediction history
- AI Model comparisons
- Available statistics

---

## 9. PREDICTIONS PAGE

Implement a complete prediction management page.

Columns:

- Prediction time
- AI Model
- League
- Match
- Prediction type
- Match minute
- Current score
- Predicted correct score
- Top pick
- Probability
- Settlement status

### Prediction Detail

Display all available data:

- Match information
- AI Model
- Current score
- Opening odds
- Pre-match odds
- Live odds
- 1X2 odds
- AH odds
- OU odds
- Corner odds, if available
- Live statistics
- Monte Carlo simulation details
- Probability distributions
- Predicted correct score
- Top two picks
- All prediction picks
- Settlement results

Use well-organized tabs or sections.

Do not hide important information unnecessarily.

Do not display fake Corner data when unavailable.

---

## 10. REPORTS PAGE

**This is one of the most important pages.**

Design a comprehensive, data-dense reporting interface.

The layout must maximize usable screen space and allow users to view all relevant information efficiently.

### UI requirements

- Full-width report layout
- Compact but readable tables
- Minimal wasted whitespace
- Collapsible filter panels
- Sticky table headers
- Horizontal scrolling when necessary
- Resizable columns where appropriate
- Column visibility controls
- Pagination
- Sorting
- Advanced filters
- Export CSV / Excel
- Expandable rows
- Detailed drill-down views

Do not truncate important data without providing a way to view the complete value.

Do not force users to open multiple pages just to compare essential information.

Use responsive layouts that prioritize data visibility.

### Report 1: AI Model Performance

Show:

- AI Model
- Total predictions
- Settled picks
- Wins
- Losses
- Win rate
- Correct score hits
- Correct score accuracy
- Performance by market
- Performance by league

### Report 2: Prediction History

Show:

- Date
- League
- Match
- AI Model
- Prediction type
- Match minute
- Current score
- Predicted score
- Actual score
- Selected market
- Odds line
- Odds value
- Predicted probability
- Actual settlement result

### Report 3: Market Performance

Compare:

- 1X2
- AH
- OU
- CORNER_AH
- CORNER_OU

Show:

- Total picks
- Wins
- Losses
- Win rate
- Pending settlements

### Report 4: AI Model Comparison

Compare multiple AI Models analyzing the same matches.

Display:

- Model name
- Prediction
- Probability
- Correct score
- Actual result
- Win/Loss outcome

### Report 5: Monte Carlo Analysis

Display:

- Simulation count
- Expected goals
- Expected corners
- Scoreline distributions
- Predicted probabilities
- Actual outcomes

All reports must use backend aggregation APIs.

Avoid loading entire large datasets into the browser.

---

## 11. PROMPT NOTES PAGE

Create a dedicated page to manage AI prompt templates.

Required prompt templates:

### Template 1: AI Football Prediction Prompt

A prompt instructing an AI Model to:

- Analyze football matches
- Interpret Opening / Pre-match / Live odds
- Analyze 1X2, AH, OU, and optional Corner
- Analyze live match statistics
- Use Monte Carlo simulation with 1000 iterations
- Estimate winning probabilities
- Predict the most probable final correct score
- Select the top two betting picks by estimated winning probability
- Produce structured JSON compatible with the external prediction callback API

Important:

- Live AH must be interpreted using the correct settlement basis.
- Current live score must not be reset to 0-0.
- Corner is optional.
- Do not invent missing data.

### Template 2: AI Settlement Calculation Prompt

A prompt instructing an AI Model to:

- Analyze original betting picks
- Read original odds and lines
- Read actual match results
- Calculate WIN / LOSS / HALF_WIN / HALF_LOSS / PUSH / VOID
- Correctly interpret Asian Handicap quarter lines
- Correctly handle live settlement basis
- Handle Corner markets
- Return structured JSON compatible with the settlement API

The prompt must explicitly distinguish AI-calculated explanations from authoritative backend settlement.

### Prompt Editor Features

- List prompt templates
- View prompt content
- Edit prompt content
- Save changes
- Copy to clipboard
- Reset unsaved changes
- Display last updated time
- Show success/error notifications

Use a large, comfortable editor.

Preserve line breaks and formatting.

Use a native textarea or an appropriate text editor.

Provide prominent buttons:

- Edit
- Save
- Cancel
- Copy to Clipboard

Store prompt content in PostgreSQL.

Provide useful default templates through database migrations or initialization.

The prompt content must be fully editable without changing application source code.

---

## 12. PROVIDERS & AI MODELS PAGES

### Providers

Implement:

- Provider list
- Add provider
- Edit provider
- Enable/disable provider
- Generate API credentials
- Rotate API credentials
- Revoke credentials
- View callback activity

Never display existing API key secrets after initial creation.

### AI Models

Implement:

- AI Model list
- Model details
- Provider association
- Model version
- Total predictions
- Win rate
- Recent predictions
- Model performance

---

## 13. API LOGS PAGE

Display external API activity.

Columns:

- Timestamp
- Provider
- Endpoint
- Event ID
- HTTP status
- Processing result
- Processing duration
- Error message

Features:

- Search
- Filters
- Pagination
- Request detail view

Never expose credentials or sensitive secrets in logs.

---

## 14. BACKEND API REQUIREMENTS

Create REST APIs for:

- Authentication
- Dashboard
- Matches
- Predictions
- Prediction details
- Prediction odds
- Prediction stats
- Prediction simulations
- Prediction picks
- Prediction settlements
- AI Models
- Providers
- Prompt templates
- Reports
- API logs
- External callbacks

Use consistent API response formats.

Implement:

- DTO validation
- Pagination
- Sorting
- Filtering
- Error handling
- Proper HTTP status codes
- OpenAPI documentation
- Database transactions
- Authorization checks

Never expose JPA entities directly through controllers.

---

## 15. BUSINESS RULES

### Prediction Rules

- One match can have predictions from multiple AI Models.
- One AI Model can analyze the same match multiple times.
- Preserve every prediction snapshot.
- Support PRE_MATCH and LIVE.
- Store actual match score at prediction time.
- Store original odds snapshots.
- Never fabricate missing data.

### Corner Rules

- Corner is optional.
- Missing Corner must not cause callback failure.
- Corner AH and Corner OU can be provided independently.
- Missing Corner data must not be represented as zero.

### Monte Carlo Rules

- Default simulation count is 1000.
- Store actual simulation count.
- Store probability distributions.
- Store simulation metadata.
- Probabilities must be between 0 and 1.
- Do not fabricate simulation results when the provider does not supply them.

### Settlement Rules

- Use actual match results.
- Respect original market and odds.
- Respect live settlement basis.
- Handle Asian quarter lines correctly.
- Preserve original HALF_WIN and HALF_LOSS results.
- Count HALF_WIN as WIN for win-rate reports.
- Count HALF_LOSS as LOSS for win-rate reports.
- Exclude PUSH, VOID, and PENDING from win-rate denominators.
- Do not settle incomplete matches.
- Do not silently overwrite existing settlements.
- Recalculation must be auditable.

### Data Integrity

- Enforce provider ownership.
- Prevent duplicate events.
- Use transactions.
- Preserve historical data.
- Validate foreign-key relationships.
- Do not silently discard invalid payload fields.
- Ensure callback retry safety.

---

## 16. TESTING REQUIREMENTS

Implement automated tests.

### Backend

- Unit tests
- Integration tests
- Repository tests
- API tests
- Authentication tests
- Validation tests
- Settlement calculation tests
- Idempotency tests

Use Testcontainers with PostgreSQL for integration testing where practical.

Test settlement cases including:

- 1X2
- AH positive and negative lines
- AH quarter lines
- OU quarter lines
- Live AH
- Live OU
- Corner AH
- Corner OU
- HALF_WIN
- HALF_LOSS
- PUSH
- VOID
- Missing Corner data
- Duplicate callbacks
- Invalid provider credentials

### Frontend

- Component tests
- Form validation tests
- Authentication flow tests
- API integration tests
- Report filtering tests
- Prompt editing tests
- Clipboard functionality tests

Add end-to-end tests for critical user journeys.

---

## 17. PROJECT STRUCTURE

Use a clean, organized project structure.

Example:

```text
ai-football-prediction/
├── frontend/
│   ├── src/
│   ├── angular.json
│   └── package.json
├── backend/
│   ├── src/main/java/
│   ├── src/main/resources/
│   │   ├── db/migration/
│   │   └── application.yml
│   ├── src/test/
│   └── pom.xml
├── docker/
├── docs/
│   ├── DATABASE_SCHEMA.md
│   ├── API_DOCUMENTATION.md
│   └── ARCHITECTURE.md
├── docker-compose.yml
├── .env.example
└── README.md
```

The final project must include:

- Full source code
- Complete database migrations
- API documentation
- Environment configuration examples
- Docker configuration
- Setup instructions
- Test instructions
- Sample external callback payloads

---

## 18. IMPLEMENTATION WORKFLOW

Execute the project in the following order:

### Phase 1: Architecture & Database

1. Review requirements.
2. Design application architecture.
3. Review and update PostgreSQL DDL.
4. Create Flyway migrations.
5. Validate constraints and indexes.

### Phase 2: Backend

1. Initialize Spring Boot.
2. Configure PostgreSQL.
3. Implement authentication.
4. Implement entities, repositories, services, and controllers.
5. Implement external callback authentication.
6. Implement prediction ingestion.
7. Implement match result ingestion.
8. Implement deterministic settlement calculations.
9. Implement reporting APIs.
10. Implement prompt management APIs.
11. Implement API audit logging.
12. Write backend tests.

### Phase 3: Frontend

1. Initialize Angular and the shared UI kit.
2. Configure application theme.
3. Implement login.
4. Implement application layout.
5. Implement dashboard.
6. Implement matches.
7. Implement predictions.
8. Implement reports.
9. Implement prompt notes.
10. Implement providers.
11. Implement AI Models.
12. Implement API logs.
13. Implement settings.
14. Connect all pages to backend APIs.

### Phase 4: Integration & Quality

1. Run database migrations.
2. Test external prediction callbacks.
3. Test result ingestion.
4. Test settlement calculations.
5. Test dashboard aggregations.
6. Test reports.
7. Test prompt editing and clipboard.
8. Test authentication and authorization.
9. Test responsive layouts.
10. Fix identified issues.

### Phase 5: Delivery

1. Configure Docker Compose.
2. Verify frontend/backend/database connectivity.
3. Run all automated tests.
4. Run production builds.
5. Verify critical end-to-end workflows.
6. Update documentation.
7. Provide final implementation summary.

---

## 19. UI/UX QUALITY STANDARDS

The UI must look like a professional, modern production SaaS application.

Avoid:

- Outdated admin templates
- Excessive whitespace
- Oversized cards
- Inconsistent colors
- Poorly aligned elements
- Unreadable tables
- Unnecessary scrolling
- Cluttered layouts
- Placeholder charts
- Fake statistics

Prioritize:

- Information density
- Readability
- Fast navigation
- Efficient filtering
- Clean spacing
- Professional typography
- Consistent component styling
- Clear data visualization

**For report pages specifically:**

Use as much available horizontal screen space as possible.

Keep filters compact.

Use data-dense tables.

Allow users to compare predictions, odds, probabilities, AI Models, and actual results without excessive navigation.

Provide a way to inspect every stored field, including JSONB metadata and original payloads, when authorized.

---

## 20. FINAL ACCEPTANCE CRITERIA

The project is considered complete only when:

- [ ] Angular frontend (native HTML + in-house UI kit) works.
- [ ] Java 25 + Spring Boot backend works.
- [ ] PostgreSQL database is fully integrated.
- [ ] Flyway migrations execute successfully.
- [ ] Login works without public registration.
- [ ] External AI prediction callback works.
- [ ] Unauthorized external callbacks are rejected.
- [ ] Duplicate callbacks do not create duplicate records.
- [ ] Match result insertion works.
- [ ] Settlement calculation works correctly.
- [ ] Live AH/OU settlement uses the correct basis.
- [ ] Corner remains optional.
- [ ] Monte Carlo data can be stored and displayed.
- [ ] Dashboard displays real data.
- [ ] Matches page works.
- [ ] Predictions page works.
- [ ] AI Models page works.
- [ ] Reports display complete and accurate data.
- [ ] Prompt Notes page supports editing, saving, and clipboard copying.
- [ ] Providers management works.
- [ ] API Logs page works.
- [ ] Responsive layout works.
- [ ] Docker Compose starts the application.
- [ ] Backend tests pass.
- [ ] Frontend tests pass.
- [ ] Critical end-to-end tests pass.
- [ ] Production builds succeed.
- [ ] Documentation is complete.

## FINAL INSTRUCTION

**Build the complete application from start to finish.**

Do not stop at planning, architecture, database design, or frontend mockups.

Implement every required module and connect all components into a functioning system.

Continuously review the code, execute tests, investigate failures, fix bugs, and retest.

Do not declare completion while known critical issues remain unresolved.

If a test or verification cannot be executed due to environment limitations, explicitly report the limitation rather than claiming it passed.

The final deliverable must be a working, maintainable, secure, and professionally designed AI Football Prediction Management System.
