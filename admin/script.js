import { supabase } from '../src/supabase.js';

// ─── State ────────────────────────────────────────────────────────────────────
let currentUserTab = 'student';   // 'student' | 'tutor'
let modalUser = null;             // Currently open user profile object

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    // Check Auth & Role
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
        window.location.href = '/login.html';
        return;
    }

    let role = session.user.user_metadata?.role;
    if (role !== 'admin') {
        const { data: profile } = await supabase
            .from('profiles').select('role').eq('id', session.user.id).single();
        if (profile) role = profile.role;
    }
    if (role !== 'admin') {
        alert('Access denied. Admins only.');
        window.location.href = '/';
        return;
    }

    // Sidebar Collapse Toggle
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebar = document.getElementById('sidebar');
    if (sidebarToggleBtn && sidebar) {
        sidebarToggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
    }

    initUI();
    await loadDashboardStats();
    await loadUsers('student');   // default tab
    await loadPendingTutors();
    await loadPayments();
    await loadUserCounts();       // populate tab badges
});

// ─── UI Init ─────────────────────────────────────────────────────────────────
function initUI() {
    lucide.createIcons();

    // Tab switching (dashboard sections)
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.dashboard-section');

    function setActiveSection(targetId) {
        if (!targetId) return;
        navLinks.forEach(l => {
            if(l.dataset.target === targetId) l.classList.add('active');
            else l.classList.remove('active');
        });
        sections.forEach(sec => sec.style.display = 'none');
        const targetSec = document.getElementById(targetId);
        if (targetSec) targetSec.style.display = 'block';
        
        // Persist state
        localStorage.setItem('adminActiveTab', targetId);
    }

    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            const targetId = this.dataset.target;
            if (targetId) {
                e.preventDefault();
                setActiveSection(targetId);
            }
        });
    });

    // Restore state on load
    const savedTab = localStorage.getItem('adminActiveTab');
    if (savedTab && document.getElementById(savedTab)) {
        setActiveSection(savedTab);
    } else {
        setActiveSection('section-overview'); // default
    }

    // Profile Dropdown
    const profileTrigger = document.getElementById('profile-trigger');
    const profileDropdown = document.getElementById('profile-dropdown');
    if (profileTrigger && profileDropdown) {
        profileTrigger.addEventListener('click', e => {
            e.stopPropagation();
            profileDropdown.classList.toggle('show');
        });
        document.addEventListener('click', () => profileDropdown.classList.remove('show'));
    }

    // Logout buttons
    document.querySelectorAll('.logout-btn').forEach(btn => {
        btn.addEventListener('click', async e => {
            e.preventDefault();
            await supabase.auth.signOut();
            window.location.href = '/login.html';
        });
    });
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
async function loadDashboardStats() {
    const { count: usersCount } = await supabase
        .from('profiles').select('*', { count: 'exact', head: true });

    const { count: tutorsCount } = await supabase
        .from('tutor_profiles').select('*', { count: 'exact', head: true }).eq('status', 'APPROVED');

    const { count: bookingsCount } = await supabase
        .from('bookings').select('*', { count: 'exact', head: true });

    const { data: payments } = await supabase.from('payments').select('platform_fee');
    const totalRevenue = payments
        ? payments.reduce((sum, p) => sum + (parseFloat(p.platform_fee) || 0), 0)
        : 0;

    document.getElementById('stat-total-users').textContent = usersCount || 0;
    document.getElementById('stat-active-tutors').textContent = tutorsCount || 0;
    document.getElementById('stat-total-bookings').textContent = bookingsCount || 0;
    document.getElementById('stat-revenue').textContent = `₹${totalRevenue.toFixed(2)}`;
}

// ─── User Tab Count Badges ────────────────────────────────────────────────────
async function loadUserCounts() {
    const { count: studentCount } = await supabase
        .from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student');
    const { count: tutorCount } = await supabase
        .from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'tutor');

    const sEl = document.getElementById('count-students');
    const tEl = document.getElementById('count-tutors');
    if (sEl) sEl.textContent = studentCount || 0;
    if (tEl) tEl.textContent = tutorCount || 0;
}

// ─── Switch Student / Tutor Tab ───────────────────────────────────────────────
window.switchUserTab = function (role) {
    currentUserTab = role;

    document.getElementById('tab-students').classList.toggle('active', role === 'student');
    document.getElementById('tab-tutors').classList.toggle('active', role === 'tutor');

    lucide.createIcons();   // re-render icons inside the newly active tab
    loadUsers(role);
};

// ─── Load Users by Role ───────────────────────────────────────────────────────
async function loadUsers(role) {
    const listEl = document.getElementById('users-list');
    const emptyEl = document.getElementById('users-empty');
    if (!listEl) return;

    listEl.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#9ca3af;padding:2rem;">Loading…</td></tr>';
    if (emptyEl) emptyEl.style.display = 'none';

    // Fetch profiles filtered by role (exclude admins)
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', role)
        .order('created_at', { ascending: false });

    if (error || !profiles) {
        listEl.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#ef4444;">Failed to load users.</td></tr>';
        return;
    }

    // If tutor tab — also pull tutor_profiles status
    let tutorStatusMap = {};
    if (role === 'tutor') {
        const { data: tutorProfiles } = await supabase
            .from('tutor_profiles').select('user_id, status');
        if (tutorProfiles) {
            tutorProfiles.forEach(t => { tutorStatusMap[t.user_id] = t.status; });
        }
    }

    listEl.innerHTML = '';

    if (profiles.length === 0) {
        if (emptyEl) emptyEl.style.display = 'block';
        return;
    }

    profiles.forEach(user => {
        const tr = document.createElement('tr');
        const joined = user.created_at
            ? new Date(user.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            : '—';
        const statusBadge = user.is_blocked
            ? '<span class="status-badge badge-blocked">🔒 Blocked</span>'
            : '<span class="status-badge badge-active">✓ Active</span>';
        const emailDisplay = user.email || '—';

        // For tutors show approval status in the "Joined" column temporarily repurposed
        let extraInfo = joined;
        if (role === 'tutor') {
            const ts = tutorStatusMap[user.id] || 'N/A';
            extraInfo = `${joined} <br><span style="font-size:0.72rem;color:#6b7280;">Approval: ${ts}</span>`;
        }

        tr.innerHTML = `
            <td>
                <div style="display:flex;align-items:center;gap:0.75rem;">
                    <div style="width:36px;height:36px;border-radius:50%;background:var(--primary-100);
                        color:var(--primary-700);display:flex;align-items:center;justify-content:center;
                        font-weight:700;font-size:0.875rem;flex-shrink:0;">
                        ${(user.first_name || '?')[0].toUpperCase()}
                    </div>
                    <div>
                        <div style="font-weight:600;">${user.first_name || ''} ${user.last_name || ''}</div>
                        ${user.is_blocked ? '<div style="font-size:0.72rem;color:#ef4444;">Account Blocked</div>' : ''}
                    </div>
                </div>
            </td>
            <td style="color:var(--gray-600);font-size:0.875rem;">${emailDisplay}</td>
            <td style="color:var(--gray-500);font-size:0.875rem;">${extraInfo}</td>
            <td>${statusBadge}</td>
        `;

        // Store full user data on the row for the modal
        tr._userData = { ...user, tutorStatus: tutorStatusMap[user.id] || null };
        tr.addEventListener('click', () => openUserModal(tr._userData));
        listEl.appendChild(tr);
    });

    lucide.createIcons();
}

// ─── User Detail Modal ────────────────────────────────────────────────────────
window.openUserModal = function (user) {
    modalUser = user;
    const modal = document.getElementById('user-detail-modal');

    // Avatar
    const avatarEl = document.getElementById('modal-user-avatar');
    avatarEl.textContent = (user.first_name || '?')[0].toUpperCase();

    // Header
    document.getElementById('modal-user-name').textContent =
        `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown User';
    document.getElementById('modal-user-role').textContent =
        user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '—';

    // Body fields
    document.getElementById('modal-user-email').textContent = user.email || '—';
    document.getElementById('modal-user-id').textContent = user.id || '—';
    document.getElementById('modal-user-role-val').textContent =
        user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '—';
    document.getElementById('modal-user-joined').textContent = user.created_at
        ? new Date(user.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
        : '—';

    // Tutor-specific approval status
    const tutorRow = document.getElementById('modal-tutor-status-row');
    if (user.role === 'tutor' && user.tutorStatus) {
        tutorRow.style.display = 'flex';
        document.getElementById('modal-tutor-status').textContent = user.tutorStatus;
    } else {
        tutorRow.style.display = 'none';
    }

    // Account status badge
    const statusEl = document.getElementById('modal-user-status');
    if (user.is_blocked) {
        statusEl.innerHTML = '<span class="status-badge badge-blocked">🔒 Blocked</span>';
    } else {
        statusEl.innerHTML = '<span class="status-badge badge-active">✓ Active</span>';
    }

    // Block reason row
    const reasonRow = document.getElementById('modal-block-reason-row');
    const reasonEl = document.getElementById('modal-block-reason');
    if (user.is_blocked && user.block_reason) {
        reasonRow.style.display = 'flex';
        reasonEl.textContent = user.block_reason;
    } else {
        reasonRow.style.display = 'none';
    }

    // Block / Unblock button
    const blockBtn = document.getElementById('modal-block-btn');
    if (user.is_blocked) {
        blockBtn.textContent = '✓ Unblock User';
        blockBtn.className = 'modal-btn modal-btn-unblock';
    } else {
        blockBtn.textContent = '🔒 Block User';
        blockBtn.className = 'modal-btn modal-btn-block';
    }

    modal.classList.add('open');
};

window.closeUserModal = function () {
    document.getElementById('user-detail-modal').classList.remove('open');
    modalUser = null;
};

window.modalToggleBlock = async function () {
    if (!modalUser) return;

    const willBlock = !modalUser.is_blocked;
    let blockReason = null;

    if (willBlock) {
        blockReason = prompt(
            `Reason for blocking ${modalUser.first_name || 'this user'} (this will be stored):\n` +
            `(Leave blank for "Policy violation")`
        );
        if (blockReason === null) return;  // user cancelled
        blockReason = blockReason.trim() || 'Policy violation';
    }

    const updatePayload = { is_blocked: willBlock };
    if (willBlock) updatePayload.block_reason = blockReason;
    else updatePayload.block_reason = null;

    const { error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', modalUser.id);

    if (error) {
        alert('Error updating user: ' + error.message);
        return;
    }

    alert(willBlock
        ? `✅ ${modalUser.first_name || 'User'} has been blocked.`
        : `✅ ${modalUser.first_name || 'User'} has been unblocked.`
    );

    closeUserModal();
    await loadUsers(currentUserTab);
    await loadUserCounts();
};

// Close modal on backdrop click
document.addEventListener('click', e => {
    const modal = document.getElementById('user-detail-modal');
    if (modal && e.target === modal) closeUserModal();
});

// ─── Payments ─────────────────────────────────────────────────────────────────
async function loadPayments() {
    const listEl = document.getElementById('payments-list');
    if (!listEl) return;

    const { data: payments, error } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false });

    if (error || !payments) return;

    listEl.innerHTML = '';
    payments.forEach(pay => {
        const tr = document.createElement('tr');
        const date = new Date(pay.created_at).toLocaleDateString();
        tr.innerHTML = `
            <td style="font-family: monospace; font-size: 0.75rem;">${pay.booking_id}</td>
            <td>₹${pay.amount}</td>
            <td style="color: var(--primary-600); font-weight: bold;">₹${pay.platform_fee}</td>
            <td>₹${pay.tutor_share}</td>
            <td>${date}</td>
        `;
        listEl.appendChild(tr);
    });
}

// ─── Pending Tutors ───────────────────────────────────────────────────────────
async function loadPendingTutors() {
    const listEl = document.getElementById('pending-tutors-list');
    if (!listEl) return;

    const { data: tutors, error } = await supabase
        .from('tutor_profiles')
        .select(`*, profiles:user_id (first_name, last_name)`)
        .eq('status', 'PENDING');

    if (error || !tutors) {
        console.error('Error loading tutors:', error);
        return;
    }

    const badge = document.getElementById('pending-tutor-badge');
    if (badge) {
        if (tutors.length > 0) {
            badge.textContent = tutors.length;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }

    listEl.innerHTML = '';
    tutors.forEach(tutor => {
        const tr = document.createElement('tr');
        
        const photoUrl = tutor.profile_photo_url || 'https://ui-avatars.com/api/?name=' + (tutor.profiles?.first_name || 'T') + '&background=f1f5f9&color=64748b';
        
        tr.innerHTML = `
            <td>
                <div style="display:flex; gap:12px; align-items:center;">
                    <img src="${photoUrl}" alt="Profile" style="width:50px; height:50px; border-radius:50%; object-fit:cover; border:1px solid #e2e8f0;">
                    <div>
                        <div style="font-weight:600; color:#1e293b;">${tutor.profiles?.first_name || 'N/A'} ${tutor.profiles?.last_name || ''}</div>
                        <div style="font-size:0.75rem; color:#64748b; margin-top:2px;">${tutor.headline || 'No Headline'}</div>
                        <div style="font-size:0.75rem; color:#059669; font-weight:500; text-transform:capitalize; margin-top:2px;">${tutor.category}</div>
                        ${tutor.linkedin && tutor.linkedin !== 'NA' ? `<a href="${tutor.linkedin}" target="_blank" style="font-size:0.75rem; color:#3b82f6; text-decoration:none;">LinkedIn / Rev</a>` : `<span style="font-size:0.75rem; color:#94a3b8;">No Link</span>`}
                    </div>
                </div>
            </td>
            <td>
                <div style="font-size:0.875rem; color:#475569; max-width:250px; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;" title="${tutor.bio}">
                    ${tutor.bio || '—'}
                </div>
            </td>
            <td>
                <div style="display: flex; gap: 8px; flex-wrap:wrap;">
                    <button class="btn-sm btn-success" style="font-size:11px;" onclick="openDocumentModal('${tutor.video_url || ''}', 'Intro Video')">Video</button>
                    <button class="btn-sm btn-success" style="background:#6366f1; font-size:11px;" onclick="openDocumentModal('${tutor.certs_url || ''}', 'Certificates')">Certs</button>
                </div>
            </td>
            <td>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-sm btn-success" onclick="reviewTutor('${tutor.user_id}', 'APPROVED')">Approve</button>
                    <button class="btn btn-sm btn-danger" onclick="reviewTutor('${tutor.user_id}', 'REJECTED')">Reject</button>
                </div>
            </td>
        `;
        listEl.appendChild(tr);
    });
}

window.openDocumentModal = function(url, title) {
    if (!url || url === 'NA') {
        alert('No valid link provided.');
        return;
    }
    
    // Replace "/view" with "/preview" for Google Drive links
    let embedUrl = url;
    if (embedUrl.includes('drive.google.com') && embedUrl.includes('/view')) {
        embedUrl = embedUrl.replace('/view', '/preview');
    }
    
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-iframe').src = embedUrl;
    document.getElementById('link-modal').style.display = 'flex';
};

window.reviewTutor = async (tutorId, status) => {
    let feedback = '';
    if (status === 'REJECTED') {
        feedback = prompt('Provide rejection reason (shown to tutor):') || 'Incomplete documentation.';
    }

    const { error } = await supabase
        .from('tutor_profiles')
        .update({ status, admin_feedback: feedback })
        .eq('user_id', tutorId);

    if (error) {
        alert('Error updating status: ' + error.message);
    } else {
        alert('Tutor ' + (status === 'APPROVED' ? 'Approved!' : 'Rejected.'));
        loadPendingTutors();
        loadDashboardStats();
    }
};
