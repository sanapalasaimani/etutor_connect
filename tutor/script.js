import { supabase } from '../src/supabase.js';
import { initManageCourses } from './manage-courses/main.js';

let currentTutorId = null;
let currentProfile = null;
let assetsLibrary = [];

// DEBUG: Log Supabase connection info
console.log('=== SUPABASE DEBUG ===');
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('Supabase Client:', supabase);

document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    
    // DEBUG: Check session
    console.log('Checking session...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('Session:', session);
    console.log('Session Error:', sessionError);
    
    if (!session) {
        console.log('No session found, redirecting to login');
        window.location.href = '/login.html';
        return;
    }
    currentTutorId = session.user.id;

    // [CRITICAL] Blocked Check
    const { data: profile, error: profileError } = await supabase.from('profiles').select('is_blocked').eq('id', currentTutorId).single();
    if (profile && profile.is_blocked) {
        window.location.href = '/blocked.html';
        return;
    }

    console.log('Current Tutor ID:', currentTutorId);

    try {
        // 1. Fetch Profile and check Approval Gate
        console.log('Fetching tutor profile...');
        const { data: tutorProfile, error: tutorError } = await supabase
            .from('tutor_profiles')
            .select('*')
            .eq('user_id', currentTutorId)
            .single();
        
        console.log('Tutor Profile Data:', tutorProfile);
        console.log('Tutor Profile Error:', tutorError);
        
        // Handle case where tutor profile doesn't exist
        if (!tutorProfile || tutorError) {
            console.log('No tutor profile found, showing gate. Error:', tutorError);
            showApprovalGate('pending', 'No tutor profile found. Please complete your application.', session.user);
            return;
        }
        
        console.log('Tutor Status:', tutorProfile.status);
        
        if (tutorProfile.status !== 'APPROVED') {
            console.log('Showing approval gate for status:', tutorProfile.status);
            showApprovalGate(tutorProfile.status.toLowerCase(), tutorProfile.admin_feedback, session.user);
            return;
        }

        // 2. Update Profile Display in Header
        updateProfileDisplay(session.user, tutorProfile);

        // 3. Switch into Content View
        initDashboard();
    } catch (error) {
        console.error('Error in tutor initialization:', error);
        showApprovalGate('pending', 'Error loading profile data. Please try again.', session.user);
    }
});

function updateProfileDisplay(user, tutorProfile) {
    // Update welcome message
    const welcomeHeader = document.querySelector('h1');
    if (welcomeHeader) {
        const firstName = user.user_metadata?.first_name || 'Tutor';
        welcomeHeader.textContent = `Welcome Back, ${firstName}`;
    }

    // Update profile avatar with initials
    const avatar = document.querySelector('.w-10.h-10.rounded-full');
    if (avatar) {
        const firstName = user.user_metadata?.first_name || 'T';
        const lastName = user.user_metadata?.last_name || '1';
        const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
        avatar.textContent = initials;
    }

    // Update dropdown profile info
    const profileName = document.querySelector('#profile-dropdown p.text-sm.font-medium');
    const profileEmail = document.querySelector('#profile-dropdown p.text-xs.text-gray-500');
    if (profileName) {
        profileName.textContent = `${user.user_metadata?.first_name || 'Tutor'} ${user.user_metadata?.last_name || ''}`.trim();
    }
    if (profileEmail) {
        profileEmail.textContent = user.email;
    }
}

function showApprovalGate(status, feedback, user) {
    // Create minimal green-themed lock screen
    document.body.innerHTML = `
    <div class="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div class="bg-white border border-gray-300 shadow-lg max-w-md w-full p-8 text-center">
            <!-- Lock Icon -->
            <div class="mb-6">
                <div class="w-20 h-20 mx-auto ${status === 'approved' ? 'bg-green-500' : status === 'rejected' ? 'bg-red-500' : 'bg-green-600'} flex items-center justify-center">
                    <i data-lucide="${status === 'approved' ? 'unlock' : status === 'rejected' ? 'x-circle' : 'lock'}" class="w-10 h-10 text-white"></i>
                </div>
            </div>
            
            <!-- Status Badge -->
            <div class="inline-block px-3 py-1 text-sm font-semibold mb-4 ${
                status === 'approved' ? 'bg-green-100 text-green-800' : 
                status === 'rejected' ? 'bg-red-100 text-red-800' : 
                'bg-green-100 text-green-800'
            }">
                ${status.toUpperCase()}
            </div>
            
            <!-- Title and Message -->
            <h1 class="text-xl font-bold text-gray-900 mb-3">
                ${status === 'approved' ? 'Account Approved!' : 
                  status === 'rejected' ? 'Application Rejected' : 
                  'Account Under Review'}
            </h1>
            
            <p class="text-gray-600 mb-6">
                ${status === 'approved' ? 
                    `Congratulations ${user?.user_metadata?.first_name || ''}! Your application has been accepted by our team.` :
                  status === 'rejected' ? 
                    'Unfortunately, we could not approve your application at this time.' :
                    'Your tutor application is currently being reviewed by our admin team.'}
            </p>
            
            <!-- Feedback Section -->
            ${feedback ? `
                <div class="bg-gray-50 border border-gray-200 p-4 mb-6 text-left">
                    <h4 class="font-semibold text-gray-800 mb-2">
                        Admin Feedback:
                    </h4>
                    <p class="text-gray-700 text-sm">${feedback}</p>
                </div>
            ` : ''}
            
            <!-- Action Buttons -->
            <div class="space-y-3">
                ${status === 'approved' ? 
                    `<button onclick="location.reload()" class="w-full bg-green-500 text-white px-6 py-2 font-semibold hover:bg-green-600">
                        Enter Dashboard
                    </button>` :
                  status === 'rejected' ? 
                    `<a href="/login.html" class="block w-full bg-red-500 text-white px-6 py-2 font-semibold hover:bg-red-600">
                        Return to Login
                    </a>` :
                    `<div class="space-y-3">
                        <button onclick="checkApprovalStatus()" class="w-full bg-green-500 text-white px-6 py-2 font-semibold hover:bg-green-600">
                            Check Status
                        </button>
                        <a href="/login.html" class="block w-full bg-gray-200 text-gray-700 px-6 py-2 font-semibold hover:bg-gray-300">
                            Logout
                        </a>
                    </div>`
                }
            </div>
            
            <!-- Progress Steps for Pending -->
            ${status === 'pending' ? `
                <div class="mt-8 pt-6 border-t border-gray-200">
                    <div class="flex justify-between items-center relative">
                        <div class="absolute top-1/2 left-0 w-full h-0.5 bg-gray-200"></div>
                        <div class="absolute top-1/2 left-0 w-1/3 h-0.5 bg-green-500"></div>
                        
                        <div class="relative flex flex-col items-center">
                            <div class="w-6 h-6 bg-green-500 text-white flex items-center justify-center text-xs font-bold">
                                <i data-lucide="check" class="w-3 h-3"></i>
                            </div>
                            <span class="text-xs mt-1 text-gray-700">Submitted</span>
                        </div>
                        <div class="relative flex flex-col items-center">
                            <div class="w-6 h-6 bg-green-500 text-white flex items-center justify-center text-xs font-bold">
                                2
                            </div>
                            <span class="text-xs mt-1 text-gray-700">Review</span>
                        </div>
                        <div class="relative flex flex-col items-center">
                            <div class="w-6 h-6 bg-gray-300 text-gray-600 flex items-center justify-center text-xs font-bold">
                                3
                            </div>
                            <span class="text-xs mt-1 text-gray-500">Decision</span>
                        </div>
                    </div>
                </div>
            ` : ''}
        </div>
    </div>`;
    
    // Re-initialize lucide icons
    lucide.createIcons();
    
    // Store user data for status checking
    window.currentUser = user;
}

// Function to check approval status (for pending users)
window.checkApprovalStatus = async () => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            window.location.href = '/login.html';
            return;
        }

        const { data: tutorProfile } = await supabase.from('tutor_profiles').select('*').eq('user_id', session.user.id).single();
        
        if (tutorProfile.status === 'APPROVED') {
            // Show success notification
            showNotification('Congratulations! Your application has been approved!', 'success');
            // Reload page after a short delay
            setTimeout(() => location.reload(), 2000);
        } else if (tutorProfile.status === 'REJECTED') {
            showApprovalGate('rejected', tutorProfile.admin_feedback, session.user);
        } else {
            showNotification('Still under review. Please check back later.', 'info');
        }
    } catch (error) {
        console.error('Error checking approval status:', error);
        showNotification('Error checking status. Please try again.', 'error');
    }
};

// Notification function
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg backdrop-blur-lg ${
        type === 'success' ? 'bg-green-500/90 text-white' : 
        type === 'error' ? 'bg-red-500/90 text-white' : 
        'bg-blue-500/90 text-white'
    } transform translate-x-full transition-transform duration-300`;
    notification.innerHTML = `
        <div class="flex items-center gap-3">
            <i data-lucide="${type === 'success' ? 'check-circle' : type === 'error' ? 'x-circle' : 'info'}" class="w-5 h-5"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    lucide.createIcons();
    
    // Animate in
    setTimeout(() => notification.classList.remove('translate-x-full'), 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.add('translate-x-full');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function initDashboard() {
    // Sidebar Tab Switching
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            const target = e.currentTarget.dataset.target;
            if(target) {
                e.preventDefault();
                showSection(target);
            }
        });
    });

    // Core Dashboard Initial Loads
    showSection('section-courses');
    loadCoursesSummary();
    loadAnalytics();
    loadPayoutDetails();
    updateTutorBadgeCounts();
}

window.verifyPayoutDetails = () => {
    const p = currentProfile;
    const hasBank = p?.payout_bank_name && p?.payout_account_no && p?.payout_ifsc;
    const hasUPI = p?.payout_phone;

    if (!hasBank && !hasUPI) {
        alert("Action Required: Please provide either your Banking Details or UPI Phone Number in the 'Earnings Explorer' to continue.");
        showSection('section-payments');
        return false;
    }
    return true;
};

function showSection(sectionId) {
    const sections = document.querySelectorAll('.dashboard-section');
    sections.forEach(sec => sec.classList.add('hidden'));
    
    const target = document.getElementById(sectionId);
    if(target) {
        target.classList.remove('hidden');
        if (sectionId === 'section-courses') {
            initManageCourses('section-courses');
        }
        if (sectionId === 'section-notifications') {
            loadNotifications();
        }
    }

    // Update active nav styling
    document.querySelectorAll('.nav-link').forEach(link => {
        if(link.dataset.target === sectionId) {
            link.classList.add('bg-emerald-50', 'text-emerald-700');
            link.classList.remove('hover:bg-gray-50');
        } else {
            link.classList.remove('bg-emerald-50', 'text-emerald-700');
            link.classList.add('hover:bg-gray-50');
        }
    });
}

async function loadAnalytics() {
    const { data: payments } = await supabase.from('payments').select('*');
    const { data: enrollments } = await supabase.from('courses').select('id, modules(id)'); // simplistic
    // Better: count from student_progress
    const { data: studentsRecords } = await supabase.from('student_progress').select('student_id', { count: 'exact', head: true });
    const { count: enrollCount } = await supabase.from('student_progress').select('*', { count: 'exact', head: true });

    let totalNet = 0;
    if (payments) {
        // 1. Get payments from bookings
        const { data: tutorBookings } = await supabase.from('bookings').select('id').eq('tutor_id', currentTutorId);
        const bookingIds = tutorBookings?.map(b => b.id) || [];
        
        // 2. Get payments from courses owned by tutor
        const { data: tutorCourses } = await supabase.from('courses').select('id').eq('tutor_id', currentTutorId);
        const courseIds = tutorCourses?.map(c => c.id) || [];

        const myPayments = payments.filter(p => 
            (p.booking_id && bookingIds.includes(p.booking_id)) || 
            (p.course_id && courseIds.includes(p.course_id))
        );
        totalNet = myPayments.reduce((acc, p) => acc + Number(p.tutor_share), 0);
    }

    document.getElementById('stat-total-earned').textContent = `₹${totalNet.toLocaleString()}`;
    document.getElementById('stat-active-students').textContent = studentsRecords || 0;
    document.getElementById('stat-total-enrollments').textContent = enrollCount || 0;
    
    // Also update balance in payments if visible
    if (document.getElementById('display-balance')) {
        document.getElementById('display-balance').textContent = `₹${totalNet.toLocaleString()}`;
        document.getElementById('display-gross').textContent = `₹${((totalNet / 0.9) || 0).toFixed(0)}`;
        document.getElementById('display-fee').textContent = `-₹${((totalNet / 0.9) * 0.1 || 0).toFixed(0)}`;
    }
}

async function loadPayoutDetails() {
    const { data } = await supabase.from('tutor_profiles').select('payout_phone, payout_bank_name, payout_ifsc, payout_account_no, payout_branch').eq('user_id', currentTutorId).single();
    if (data) {
        currentProfile = { ...currentProfile, ...data };
        if (document.getElementById('payout-phone')) document.getElementById('payout-phone').value = data.payout_phone || '';
        if (document.getElementById('payout-bank-name')) document.getElementById('payout-bank-name').value = data.payout_bank_name || '';
        if (document.getElementById('payout-ifsc')) document.getElementById('payout-ifsc').value = data.payout_ifsc || '';
        if (document.getElementById('payout-account-no')) document.getElementById('payout-account-no').value = data.payout_account_no || '';
        if (document.getElementById('payout-branch')) document.getElementById('payout-branch').value = data.payout_branch || '';
    }
    loadEarningsHistory();
}

window.savePayoutDetails = async () => {
    const updateData = {
        payout_phone: document.getElementById('payout-phone').value,
        payout_bank_name: document.getElementById('payout-bank-name').value,
        payout_ifsc: document.getElementById('payout-ifsc').value,
        payout_account_no: document.getElementById('payout-account-no').value,
        payout_branch: document.getElementById('payout-branch').value
    };
    
    const isUPIFilled = !!updateData.payout_phone;
    const isBankFilled = updateData.payout_bank_name && updateData.payout_account_no && updateData.payout_ifsc;

    if (!isUPIFilled && !isBankFilled) {
        return alert('Please fill at least one payout method: Either UPI Phone Number OR complete Bank Details.');
    }
    
    const { error } = await supabase.from('tutor_profiles').update(updateData).eq('user_id', currentTutorId);
    
    if (error) alert('Error: ' + error.message);
    else {
        alert('Payment details updated successfully!');
        currentProfile = { ...currentProfile, ...updateData };
    }
}

async function loadEarningsHistory() {
    // 1. Get IDs of all bookings and courses for this tutor
    const { data: bookings } = await supabase.from('bookings').select('id').eq('tutor_id', currentTutorId);
    const { data: courses } = await supabase.from('courses').select('id').eq('tutor_id', currentTutorId);
    
    const bookingIds = bookings?.map(b => b.id) || [];
    const courseIds = courses?.map(c => c.id) || [];
    
    // 2. Query payments that belong to either
    const { data: payments, error } = await supabase
        .from('payments')
        .select('*')
        .or(`booking_id.in.(${bookingIds.length ? bookingIds.join(',') : '00000000-0000-0000-0000-000000000000'}),course_id.in.(${courseIds.length ? courseIds.join(',') : '00000000-0000-0000-0000-000000000000'})`)
        .order('created_at', { ascending: false });
    
    const table = document.getElementById('payout-history-table');
    if (!table) return;
    
    if (!payments?.length) {
        table.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-gray-400">No transactions recorded yet.</td></tr>';
        return;
    }

    table.innerHTML = payments.map(p => {
        const type = p.booking_id ? 'BID' : 'CID';
        const refId = (p.booking_id || p.course_id || '----').slice(0, 8);
        return `
            <tr class="border-b border-gray-50 hover:bg-gray-50/50 transition">
                <td class="p-4 text-xs font-medium text-gray-900">${new Date(p.created_at).toLocaleDateString()}</td>
                <td class="p-4">
                    <div class="flex items-center gap-2">
                        <span class="px-2 py-0.5 bg-gray-100 text-[9px] font-black rounded text-gray-500">${type}: ${refId}</span>
                        <span class="text-xs px-2 py-0.5 ${p.booking_id ? 'bg-purple-50 text-purple-600' : 'bg-emerald-50 text-emerald-600'} rounded-lg font-bold">
                            ${p.booking_id ? 'Live Session' : 'Course Enrollment'}
                        </span>
                    </div>
                </td>
                <td class="p-4 text-xs font-bold text-gray-400">₹${p.amount}</td>
                <td class="p-4 text-right">
                    <span class="text-xs font-black text-emerald-600 font-bold">₹${p.tutor_share}</span>
                </td>
            </tr>
        `;
    }).join('');
}


async function loadCoursesSummary() {
    // This is now handled by initManageCourses within showSection
}

async function updateTutorBadgeCounts() {
    if (!currentTutorId) return;
    const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentTutorId)
        .eq('is_read', false);

    const badge = document.getElementById('notification-badge');
    if (!badge) return;

    if (count > 0) {
        badge.textContent = count > 9 ? '9+' : count;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

async function loadNotifications() {
    const list = document.getElementById('notifications-list');
    list.innerHTML = '<div class="py-12 text-center text-gray-400">Checking for updates...</div>';

    const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', currentTutorId)
        .order('created_at', { ascending: false });

    if (error) return list.innerHTML = '<div class="p-4 text-red-500 text-xs">Error loading notifications</div>';
    
    // Update badge after loading
    updateTutorBadgeCounts();

    if (!notifications?.length) {
        list.innerHTML = `
            <div class="py-20 text-center border-2 border-dashed border-gray-100">
                <i data-lucide="bell-off" class="w-10 h-10 text-gray-200 mx-auto mb-3"></i>
                <p class="text-gray-400 text-sm font-bold">No notifications yet.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    list.innerHTML = notifications.map(n => `
        <div class="p-6 bg-white border border-gray-100 shadow-sm flex items-start gap-4 transition hover:border-emerald-100 ${n.is_read ? 'opacity-60' : ''}">
            <div class="w-10 h-10 bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <i data-lucide="${n.title.toLowerCase().includes('comment') ? 'message-square' : 'bell'}" class="w-5 h-5"></i>
            </div>
            <div class="flex-1">
                <div class="flex justify-between items-start">
                    <h4 class="text-sm font-black text-gray-900">${n.title}</h4>
                    <span class="text-[9px] font-bold text-gray-300 uppercase">${new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                </div>
                <p class="text-[13px] text-gray-500 mt-1 leading-relaxed">${n.message}</p>
                ${!n.is_read ? '<button onclick="markNotificationRead(\'' + n.id + '\')" class="text-[10px] font-black text-emerald-600 uppercase mt-4 hover:underline">Mark as Read</button>' : ''}
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

window.markNotificationRead = async (id) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    loadNotifications();
};

window.markAllNotificationsAsRead = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', currentTutorId);
    loadNotifications();
};

window.toggleProfileDropdown = () => {
    const dropdown = document.getElementById('profile-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
    }
};

window.handleLogout = async () => {
    console.log('Logout clicked');
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        localStorage.clear();
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Error logging out:', error);
        alert('Error logging out: ' + error.message);
    }
};

window.showSection = showSection;
