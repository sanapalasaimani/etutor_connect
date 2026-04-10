import { supabase } from '../src/supabase.js';

let currentCourse = null;
let currentEnrollment = null; // Store the enrollment record
let currentProfile = null;
let currentModules = [];
let activeModuleIndex = 0;
let currentQuiz = null; // Store active module quiz

async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '../login.html';

    const urlParams = new URLSearchParams(window.location.search);
    const courseId = urlParams.get('id');
    if (!courseId) return window.location.href = 'index.html';

    // Verify Enrollment
    const { data: enrollments, error: enrollError } = await supabase
        .from('student_progress')
        .select('*')
        .eq('student_id', session.user.id)
        .eq('course_id', courseId); // Get all progress records for this course

    if (enrollError || !enrollments || enrollments.length === 0) {
        alert("You are not enrolled in this course.");
        return window.location.href = 'index.html';
    }

    // The main enrollment record is usually the one where lesson_id/module_id is null, 
    // but for simplicity we'll just use the first one if we only have one, or find the course-level one.
    currentEnrollment = enrollments.find(e => !e.module_id) || enrollments[0];

    // Fetch Course & Modules
    const { data: course, error } = await supabase
        .from('courses')
        .select('*, modules(*)')
        .eq('id', courseId)
        .single();

    if (error || !course) return alert('Failed to load course details');

    currentCourse = course;
    currentModules = course.modules.sort((a, b) => a.order_index - b.order_index);
    
    renderSidebar();
    lucide.createIcons();
    
    // Load first module by default
    if (currentModules.length > 0) {
        selectModule(0);
    }

    updateProgressUI();
    
    // Set up Mark Complete Button
    const markBtn = document.getElementById('mark-complete-btn');
    if (markBtn) {
        markBtn.addEventListener('click', handleMarkComplete);
    }

    // Load Comments
    loadComments();

    // Set up Comment Posting
    document.getElementById('post-comment-btn')?.addEventListener('click', handlePostComment);
}

async function handleMarkComplete() {
    if (currentEnrollment?.is_completed) {
        return alert("This course is already marked as completed!");
    }

    const { error } = await supabase
        .from('student_progress')
        .update({ 
            is_completed: true, 
            completed_at: new Date().toISOString() 
        })
        .eq('id', currentEnrollment.id);

    if (error) {
        alert("Error marking course as complete: " + error.message);
    } else {
        currentEnrollment.is_completed = true;
        alert("Congratulations! You have completed the course.");
        updateProgressUI();
    }
}

function updateProgressUI() {
    const isDone = currentEnrollment?.is_completed;
    const progressPercent = isDone ? 100 : 0; // Simple for now: 0 or 100
    
    const bar = document.getElementById('player-progress-bar');
    const text = document.getElementById('progress-percent');
    const btn = document.getElementById('mark-complete-btn');

    if (bar) bar.style.width = `${progressPercent}%`;
    if (text) text.textContent = `${progressPercent}%`;
    
    if (btn) {
        if (isDone) {
            btn.classList.add('bg-emerald-500', 'text-white', 'border-emerald-600');
            btn.classList.remove('bg-gray-50', 'text-gray-400');
            btn.innerHTML = '<i data-lucide="check-circle" class="w-6 h-6"></i>';
        } else {
            btn.classList.remove('bg-emerald-500', 'text-white', 'border-emerald-600');
            btn.classList.add('bg-gray-50', 'text-gray-400');
        }
    }
    lucide.createIcons();
}

function renderSidebar() {
    const titleEl = document.getElementById('player-course-title');
    const listEl = document.getElementById('module-list');
    const countEl = document.getElementById('module-count');
    
    titleEl.textContent = currentCourse.title;
    countEl.textContent = `${currentModules.length} Modules`;
    
    listEl.innerHTML = currentModules.map((m, idx) => {
        const isActive = idx === activeModuleIndex;
        return `
            <button onclick="window.selectModule(${idx})" class="w-full flex items-center gap-4 p-5 rounded-3xl border text-left transition-all duration-300 ${isActive ? 'bg-emerald-50 border-emerald-200 shadow-sm shadow-emerald-100 ring-2 ring-emerald-500/10' : 'bg-white border-transparent hover:bg-gray-50'}">
                <div class="w-10 h-10 rounded-2xl ${isActive ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'} flex items-center justify-center font-black text-xs shrink-0 transition-colors">
                    ${(idx + 1).toString().padStart(2, '0')}
                </div>
                <div class="flex-1 overflow-hidden">
                    <p class="font-bold text-sm ${isActive ? 'text-emerald-900' : 'text-gray-900'} truncate">${m.title}</p>
                    <div class="flex items-center gap-3 mt-1.5">
                        <div class="flex items-center gap-1">
                            <i data-lucide="video" class="w-3 h-3 ${m.video_url ? 'text-emerald-500' : 'text-gray-200'}"></i>
                            <span class="text-[9px] font-black uppercase text-gray-300">Video</span>
                        </div>
                        <div class="flex items-center gap-1">
                            <i data-lucide="file-text" class="w-3 h-3 ${m.notes_url ? 'text-blue-500' : 'text-gray-200'}"></i>
                            <span class="text-[9px] font-black uppercase text-gray-300">Notes</span>
                        </div>
                    </div>
                </div>
                ${isActive ? '<i data-lucide="play" class="w-4 h-4 text-emerald-500 fill-current"></i>' : ''}
            </button>
        `;
    }).join('');
    lucide.createIcons();
}

window.selectModule = (idx) => {
    activeModuleIndex = idx;
    const module = currentModules[idx];
    
    // Update Curriculum Sidebar
    renderSidebar();

    // Update Header & Tags
    document.getElementById('current-lesson-tag').textContent = `Module ${(idx + 1).toString().padStart(2, '0')}`;
    document.getElementById('current-lesson-title').textContent = module.title;
    document.getElementById('lesson-header-title').textContent = module.title;

    // Update Video Area
    const videoContainer = document.getElementById('video-container');
    const videoLinkContainer = document.getElementById('video-link-container');
    
    if (module.video_url) {
        let embedUrl = module.video_url;
        const isDrive = embedUrl.includes('drive.google.com');
        
        if (isDrive) {
            embedUrl = embedUrl.replace('/view', '/preview').replace('/edit', '/preview');
            videoContainer.innerHTML = `<iframe src="${embedUrl}" class="absolute inset-0 w-full h-full" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
        } else {
            videoContainer.innerHTML = `
                <div class="absolute inset-0 flex flex-col items-center justify-center text-white bg-gray-900 p-8 text-center">
                    <i data-lucide="video" class="w-16 h-16 mb-4 opacity-10"></i>
                    <p class="font-bold text-lg">External Resource</p>
                    <p class="text-xs opacity-50 max-w-xs mt-2">This video is hosted on an external platform. Click the link below to watch.</p>
                </div>
            `;
        }

        videoLinkContainer.innerHTML = `
            <a href="${module.video_url}" target="_blank" class="flex items-center gap-2 text-xs font-black text-emerald-600 hover:text-emerald-700 transition">
                <span>View Full Video</span>
                <i data-lucide="external-link" class="w-3 h-3"></i>
            </a>
        `;
    } else {
        videoContainer.innerHTML = `<div class="absolute inset-0 flex items-center justify-center text-gray-500 bg-gray-950 font-black uppercase tracking-widest text-xs">No video assigned</div>`;
        videoLinkContainer.innerHTML = `<p class="text-xs text-gray-400 italic">No link</p>`;
    }

    // Update Materials
    const materialsContainer = document.getElementById('materials-link-container');
    if (module.notes_url) {
        materialsContainer.innerHTML = `
            <a href="${module.notes_url}" target="_blank" class="flex items-center gap-2 text-xs font-black text-blue-600 hover:text-blue-700 transition">
                <span>Download PDF/Notes</span>
                <i data-lucide="download-cloud" class="w-3 h-3"></i>
            </a>
        `;
    } else {
        materialsContainer.innerHTML = `<p class="text-xs text-gray-400 italic">None</p>`;
    }

    // Update Description
    document.getElementById('lesson-description').textContent = module.description || "In this module, we'll explore the core concepts and practical applications of the topic. Ensure you have the materials downloaded to follow along.";

    // Update Quiz Section
    const quizSection = document.getElementById('quiz-section-container');
    if (module.has_quiz) {
        quizSection.classList.remove('hidden');
        fetchModuleQuiz(module.id);
    } else {
        quizSection.classList.add('hidden');
    }

    lucide.createIcons();
};

async function fetchModuleQuiz(moduleId) {
    const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .eq('module_id', moduleId)
        .maybeSingle();

    if (error) console.error('Error fetching quiz:', error);
    currentQuiz = data;
}

window.openQuizModal = () => {
    if (!currentQuiz) return alert("Quiz content is not available yet.");
    
    const overlay = document.getElementById('quiz-modal-overlay');
    const container = document.getElementById('quiz-questions-container');
    const title = document.getElementById('quiz-modal-title');

    title.textContent = `${currentModules[activeModuleIndex].title} Quiz`;
    
    container.innerHTML = currentQuiz.questions.map((q, qIdx) => `
        <div class="mb-10 bg-white p-8 border border-gray-100 shadow-sm">
            <p class="text-xs font-black text-purple-600 uppercase tracking-widest mb-4">Question ${qIdx + 1}</p>
            <h4 class="text-lg font-bold text-gray-900 mb-6">${q.question}</h4>
            <div class="space-y-3">
                ${q.options.map((opt, optIdx) => `
                    <label class="flex items-center gap-4 p-4 border border-gray-100 hover:border-purple-200 hover:bg-purple-50/30 transition cursor-pointer group">
                        <input type="radio" name="q-${qIdx}" value="${optIdx}" class="w-5 h-5 text-purple-600 focus:ring-purple-500 border-gray-300">
                        <span class="text-sm font-bold text-gray-600 group-hover:text-purple-900">${opt}</span>
                    </label>
                `).join('')}
            </div>
        </div>
    `).join('');

    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
    
    document.getElementById('submit-quiz-btn').onclick = handleSubmitQuiz;
};

window.closeQuizModal = () => {
    const overlay = document.getElementById('quiz-modal-overlay');
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
};

async function handleSubmitQuiz() {
    const questions = currentQuiz.questions;
    let score = 0;
    let allAnswered = true;

    questions.forEach((q, idx) => {
        const selected = document.querySelector(`input[name="q-${idx}"]:checked`);
        if (!selected) {
            allAnswered = false;
        } else if (parseInt(selected.value) === q.correct_idx) {
            score++;
        }
    });

    if (!allAnswered) {
        return alert("Please answer all questions before submitting.");
    }

    const percent = Math.round((score / questions.length) * 100);
    const passed = percent >= 60;

    if (passed) {
        alert(`Congratulations! You passed with ${percent}% (${score}/${questions.length})`);
        
        // Record or Update module progress
        const { data: { user } } = await supabase.auth.getUser();
        
        const { data: existing } = await supabase
            .from('student_progress')
            .select('id')
            .eq('student_id', user.id)
            .eq('course_id', currentCourse.id)
            .eq('module_id', currentModules[activeModuleIndex].id)
            .maybeSingle();

        if (existing) {
            await supabase.from('student_progress').update({
                is_completed: true,
                quiz_score: percent,
                completed_at: new Date().toISOString()
            }).eq('id', existing.id);
        } else {
            await supabase.from('student_progress').insert({
                student_id: user.id,
                course_id: currentCourse.id,
                module_id: currentModules[activeModuleIndex].id,
                is_completed: true,
                quiz_score: percent,
                completed_at: new Date().toISOString()
            });
        }
        
        window.closeQuizModal();
    } else {
        alert(`You scored ${percent}%. You need at least 60% to pass. Try again!`);
    }
}

async function loadComments() {
    if (!currentCourse) return;
    
    const { data: comments, error } = await supabase
        .from('course_comments')
        .select('*, profiles(first_name, last_name)')
        .eq('course_id', currentCourse.id)
        .order('created_at', { ascending: false });

    if (error) return console.error('Error loading comments:', error);

    const listEl = document.getElementById('comment-list');
    const countEl = document.getElementById('comment-count');
    
    countEl.textContent = comments.length;
    
    if (comments.length === 0) {
        listEl.innerHTML = '<p class="text-xs text-gray-400 italic py-4">No comments yet. Be the first to start the discussion!</p>';
        return;
    }

    listEl.innerHTML = comments.map(c => `
        <div class="p-6 bg-white border border-gray-100 shadow-sm transition">
            <div class="flex items-center gap-3 mb-3">
                <div class="w-8 h-8 bg-gray-900 text-white flex items-center justify-center text-[10px] font-black uppercase">
                    ${(c.profiles?.first_name?.[0] || 'U')}
                </div>
                <div>
                    <p class="text-xs font-black text-gray-900">${c.profiles?.first_name} ${c.profiles?.last_name || ''}</p>
                    <p class="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">${new Date(c.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
            </div>
            <p class="text-sm text-gray-600 leading-relaxed">${c.content}</p>
        </div>
    `).join('');
}

async function handlePostComment() {
    const input = document.getElementById('comment-input');
    const content = input.value.trim();
    if (!content) return;

    const btn = document.getElementById('post-comment-btn');
    btn.disabled = true;
    btn.textContent = 'Posting...';

    const { data: { user } } = await supabase.auth.getUser();
    
    const { error: cError } = await supabase
        .from('course_comments')
        .insert({
            course_id: currentCourse.id,
            user_id: user.id,
            content: content
        });

    if (cError) {
        alert("Error posting comment: " + cError.message);
    } else {
        // Notify Tutor
        await supabase.from('notifications').insert({
            user_id: currentCourse.tutor_id,
            title: 'New Course Comment',
            message: `A student commented on your course "${currentCourse.title}".`
        });

        input.value = '';
        loadComments();
    }

    btn.disabled = false;
    btn.textContent = 'Post Comment';
}

init();
