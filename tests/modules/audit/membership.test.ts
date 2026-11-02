import * as api from '@/modules/audit/api'

import { describeMembershipProof } from '@tests/fixtures/membership'

// Audit exports nothing yet (slice 10). The proof fails as soon as it
// exports a query without a case here.
describeMembershipProof('audit', api, { commands: [], queries: {} })
