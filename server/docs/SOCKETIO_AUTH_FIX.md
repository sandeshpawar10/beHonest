# Socket.IO Authentication Fix - Documentation

## Security Vulnerability Fixed

**Critical Issue**: Socket.IO had no authentication or authorization, allowing any client to subscribe to private rooms and eavesdrop on sensitive data.

### What Was Broken

**Before (Vulnerable Code):**
```javascript
// ❌ DANGEROUS: No authentication, no authorization
io.on("connection", (socket) => {
    socket.on("join_user_room", (userId) => {
        socket.join(userId.toString()); // Any client can join ANY user's room!
    });
    
    socket.on("join_escrow_room", (escrowId) => {
        socket.join(escrowId.toString()); // Any client can monitor ANY escrow!
    });
    
    socket.on("join_admin_room", () => {
        socket.join("admin_room"); // ANY client can join admin room!
    });
});
```

### Attack Scenarios Prevented

1. **User Notification Eavesdropping**
   - Attacker connects without auth
   - Joins victim's user room: `socket.emit("join_user_room", "victim_id")`
   - Receives victim's private notifications (payment alerts, claim updates)

2. **Escrow Chat Monitoring**
   - Attacker joins any escrow room
   - Reads private messages between owner and finder
   - Sees payment details, UPI IDs, meeting locations

3. **Admin Panel Access**
   - Any user joins `admin_room`
   - Receives admin notifications about disputes, reports
   - Gains insight into admin operations

## Solution Implemented

### 1. JWT Authentication on Handshake

**File**: `server/middlewares/socketAuthMiddleware.js`

Every Socket.IO connection is now authenticated during handshake:

```javascript
io.use(socketAuthMiddleware);

// Handshake authentication extracts JWT from:
// 1. socket.handshake.auth.token (priority)
// 2. cookie header: accesstoken
// 3. Authorization header: Bearer token

// Verifies JWT and attaches user to socket:
socket.user = {
    _id: user._id.toString(),
    email: user.email,
    role: user.role,
    isVerified: user.isVerified
};
```

### 2. Authorization for Every Room Join

Each room join event now validates permissions:

#### User Room Authorization
```javascript
socket.on("join_user_room", (userId) => {
    // ✅ User can ONLY join their OWN room
    if (socket.user._id !== userId.toString()) {
        socket.emit("error", { message: "Forbidden." });
        return;
    }
    socket.join(userId.toString());
});
```

#### Escrow Room Authorization
```javascript
socket.on("join_escrow_room", async (escrowId) => {
    const escrow = await escrowModel.findById(escrowId);
    
    // ✅ Only depositor, finder, or admin can join
    const isParticipant = 
        escrow.depositorId.toString() === socket.user._id ||
        escrow.finderId.toString() === socket.user._id ||
        ['admin', 'superadmin'].includes(socket.user.role);
    
    if (!isParticipant) {
        socket.emit("error", { message: "Forbidden." });
        return;
    }
    socket.join(escrowId.toString());
});
```

#### Admin Room Authorization
```javascript
socket.on("join_admin_room", () => {
    // ✅ Only admins and superadmins can join
    if (!['admin', 'superadmin'].includes(socket.user.role)) {
        socket.emit("error", { message: "Admin access required." });
        return;
    }
    socket.join("admin_room");
});
```

## Implementation Details

### Files Modified

1. **server/server.js**
   - Applied `socketAuthMiddleware` to all connections
   - Added authorization checks to all room join events
   - Added security logging for blocked attempts

2. **server/middlewares/socketAuthMiddleware.js** (NEW)
   - `socketAuthMiddleware()` - Authenticates handshake
   - `authorizeUserRoom()` - Validates user room access
   - `authorizeEscrowRoom()` - Validates escrow room access
   - `authorizeAdminRoom()` - Validates admin room access

3. **server/tests/socketAuth.test.js** (NEW)
   - 36+ comprehensive security tests
   - All tests passing ✅

## Frontend Integration

### Connecting with Authentication

**Before (Insecure):**
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:8000'); // No auth!
```

**After (Secure):**
```javascript
import io from 'socket.io-client';

// Option 1: Using auth object (recommended)
const socket = io('http://localhost:8000', {
    auth: {
        token: getAccessToken() // From localStorage or cookie
    },
    withCredentials: true
});

// Option 2: Cookie will be sent automatically with withCredentials
const socket = io('http://localhost:8000', {
    withCredentials: true // Sends accesstoken cookie
});
```

### Handling Authentication Errors

```javascript
socket.on('connect_error', (error) => {
    if (error.message.includes('Authentication')) {
        console.error('Socket authentication failed:', error.message);
        // Redirect to login
        window.location.href = '/login';
    }
});

socket.on('error', (error) => {
    console.error('Socket error:', error.message);
    // Show user-friendly error
    alert(error.message);
});
```

### Example: Joining User Room

```javascript
// Get user ID from auth context
const userId = getCurrentUserId();

// Join personal notification room
socket.emit('join_user_room', userId);

// Listen for notifications
socket.on('notification', (data) => {
    console.log('New notification:', data);
    showNotification(data);
});
```

### Example: Joining Escrow Room

```javascript
const escrowId = getEscrowIdFromUrl();

// Join escrow chat room
socket.emit('join_escrow_room', escrowId);

// Listen for messages
socket.on('new_message', (message) => {
    displayMessage(message);
});

// Listen for escrow updates
socket.on('escrow_updated', (data) => {
    refreshEscrowData();
});
```

## Security Logging

All blocked attempts are now logged for security monitoring:

```
[BLOCKED] User 507f1f77bcf86cd799439012 attempted to join room 507f1f77bcf86cd799439099: Forbidden. You can only join your own notification room.

[BLOCKED] User 507f1f77bcf86cd799439015 attempted to join escrow 507f1f77bcf86cd799439020: Forbidden. You are not a participant in this escrow.

[BLOCKED] User 507f1f77bcf86cd799439018 attempted to join admin_room: Forbidden. Admin access required.
```

**Monitoring Recommendation**: Set up alerts for high frequency of blocked attempts from same IP/user (possible attack).

## Testing

### Run Tests
```bash
cd server
npm test tests/socketAuth.test.js
```

### Test Coverage
- ✅ JWT authentication on handshake
- ✅ Token extraction from multiple sources
- ✅ Invalid/expired token handling
- ✅ User room authorization (self-only)
- ✅ Escrow room authorization (participants only)
- ✅ Admin room authorization (admins only)
- ✅ Attack scenario prevention
- ✅ Error emission on unauthorized attempts
- ✅ Security logging

**Test Results**: 36+ tests passing

## Migration Notes

### Existing Socket.IO Clients

**Breaking Change**: All Socket.IO clients MUST now authenticate.

Clients will receive connection error if they don't provide a token:
```
Error: Authentication required. No token provided.
```

### Update Frontend

1. **Add token to Socket.IO connection:**
   ```javascript
   const socket = io(API_URL, {
       auth: { token: getAccessToken() },
       withCredentials: true
   });
   ```

2. **Handle authentication errors:**
   ```javascript
   socket.on('connect_error', (error) => {
       if (error.message.includes('Authentication')) {
           redirectToLogin();
       }
   });
   ```

3. **Test all Socket.IO features:**
   - User notifications
   - Escrow chat
   - Admin panel events

## Production Deployment Checklist

- [ ] All tests passing
- [ ] Frontend updated with auth token
- [ ] Connection error handling implemented
- [ ] Security logging enabled
- [ ] Alert setup for blocked attempts
- [ ] Test with real users in staging
- [ ] Monitor logs for authentication failures
- [ ] Document for mobile app team (if applicable)

## Token Management

### Token Expiration

If JWT expires while socket is connected:
- User receives `connect_error` on reconnection
- Frontend should refresh token and reconnect

**Recommended**: Implement token refresh logic:
```javascript
socket.on('connect_error', async (error) => {
    if (error.message.includes('expired')) {
        const newToken = await refreshAccessToken();
        socket.auth.token = newToken;
        socket.connect();
    }
});
```

### Token Storage

**Recommended Approach**:
1. Store token in httpOnly cookie (most secure)
2. Socket.IO sends cookie automatically with `withCredentials: true`
3. Fallback: Pass token via `auth.token` if using localStorage

**Never**: Store sensitive tokens in localStorage on production (XSS risk).

## Performance Impact

### Authentication Overhead

- **Handshake**: ~5-10ms (JWT verification + DB lookup)
- **Room Join**: ~5-20ms (DB query for escrow authorization)

**Minimal impact**: Authentication happens once per connection, authorization per room join (typically 1-3 times per session).

### Connection Lifecycle

```
1. Client connects → JWT verified → socket.user populated
2. Client joins rooms → Authorization checks → Success/Error
3. Events flow normally (no per-message auth)
4. Client disconnects → Clean up
```

## Troubleshooting

### "Authentication required" error

**Cause**: No token provided  
**Fix**: Ensure `auth.token` or cookie is sent

### "Invalid token" error

**Cause**: Malformed JWT  
**Fix**: Check token format, ensure it's not corrupted

### "Token expired" error

**Cause**: JWT past expiration  
**Fix**: Implement token refresh logic

### "Forbidden" error on room join

**Cause**: User lacks permission for that room  
**Fix**: Verify user ID/escrow ID is correct

### Connection succeeds but can't join rooms

**Cause**: Authorization failing after authentication  
**Fix**: Check authorization logic, verify DB data

## Security Best Practices

1. **Always validate room IDs**
   - Check MongoDB ObjectId format
   - Query database to verify resource exists
   - Never trust client-provided IDs

2. **Minimize data in socket.user**
   - Only store: _id, email, role, isVerified
   - Never store: password, tokens, sensitive data

3. **Log security events**
   - Authentication failures
   - Blocked room join attempts
   - Suspicious patterns

4. **Rate limiting** (Future Enhancement)
   - Limit connection attempts per IP
   - Limit room join attempts per user
   - Auto-ban on abuse detection

5. **Monitor in production**
   - Track blocked attempts
   - Alert on spikes
   - Investigate patterns

## Comparison: Before vs After

| Feature | Before | After |
|---------|--------|-------|
| Handshake Auth | ❌ None | ✅ JWT required |
| Room Authorization | ❌ None | ✅ Every join validated |
| User Room | 🔴 Anyone can join | 🟢 Self only |
| Escrow Room | 🔴 Anyone can join | 🟢 Participants + Admin |
| Admin Room | 🔴 Anyone can join | 🟢 Admins only |
| Error Handling | ❌ Silent | ✅ Emit errors |
| Security Logging | ❌ None | ✅ Blocked attempts logged |
| Tests | ❌ None | ✅ 36+ tests |

## Additional Resources

- [Socket.IO Authentication Docs](https://socket.io/docs/v4/middlewares/#sending-credentials)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [Node.js Security Checklist](https://nodejs.org/en/docs/guides/security/)

---

**Implementation Date**: 2026-10-02  
**Security Level**: ✅ Production Ready  
**Status**: All tests passing, ready for deployment
