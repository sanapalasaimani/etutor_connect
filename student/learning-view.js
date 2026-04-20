import { supabase } from '../src/supabase.js';

let currentCourse = null;
let currentEnrollment = null; // Store the enrollment record
let currentProfile = null;
let currentModules = [];
let activeModuleIndex = 0;
let currentQuiz = null; // Store active module quiz
let currentModuleProgress = []; // Store module-specific progress records

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

    // The main enrollment record is usually the one where lesson_id/module_id is null
    currentEnrollment = enrollments.find(e => !e.module_id) || enrollments[0];
    currentModuleProgress = enrollments.filter(e => e.module_id); // Module specific progress recordings

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
    let completedModules = currentModuleProgress.filter(p => p.is_completed).length;
    let totalModules = currentModules.length;
    let progressPercent = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

    // Auto-complete course if 100%
    if (progressPercent === 100 && currentEnrollment && !currentEnrollment.is_completed) {
        supabase.from('student_progress')
            .update({ is_completed: true, completed_at: new Date().toISOString() })
            .eq('id', currentEnrollment.id).then();
        currentEnrollment.is_completed = true;
    }

    const bar = document.getElementById('player-progress-bar');
    const text = document.getElementById('progress-percent');
    const btn = document.getElementById('mark-complete-btn');

    if (bar) bar.style.width = `${progressPercent}%`;
    if (text) text.textContent = `${progressPercent}%`;

    // Hide manual complete button, as progress is now derived from module quiz completion
    if (btn) {
        btn.style.display = 'none';
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
        const isCompleted = currentModuleProgress.find(p => p.module_id === m.id && p.is_completed);
        
        return `
            <button onclick="window.selectModule(${idx})" class="group w-full relative overflow-hidden bg-white/60 text-left transition-all duration-300 transform hover:-translate-y-1 hover:shadow-lg rounded-2xl border ${isActive ? 'border-emerald-800 bg-emerald-50 hover:-translate-y-0 shadow-md shadow-emerald-500/10' : 'border-emerald-800 hover:border-emerald-700'}">
                
                <!-- Animated Background Gradient for Active State -->
                <div class="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent opacity-0 transition-opacity duration-300 ${isActive ? 'opacity-100' : 'group-hover:opacity-100'}"></div>
                
                <div class="relative p-5 flex items-center justify-between">
                    <div class="flex items-center gap-4">
                        <!-- Modern Icon Container -->
                        <div class="relative shrink-0 w-12 h-12 flex items-center justify-center rounded-[14px] transition-all duration-300 ${isCompleted ? 'bg-emerald-200 text-emerald-700' : (isActive ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30' : 'bg-emerald-50 text-emerald-600/50 group-hover:bg-emerald-100 group-hover:text-emerald-600')}">
                            ${isCompleted 
                                ? '<i data-lucide="check" class="w-6 h-6"></i>' 
                                : (isActive 
                                    ? '<i data-lucide="play" class="w-5 h-5 ml-1 fill-current"></i>' 
                                    : `<span class="font-bold text-[13px]">${(idx + 1).toString().padStart(2, '0')}</span>`)}
                        </div>
                        
                        <!-- Content -->
                        <div class="flex flex-col gap-1.5">
                            <h4 class="font-bold text-sm ${isActive ? 'text-emerald-900' : 'text-gray-800 group-hover:text-gray-900'} transition-colors line-clamp-1 pr-2">${m.title}</h4>
                            
                            <div class="flex items-center gap-3">
                                ${m.video_url ? `
                                    <span class="flex items-center gap-1 text-[9px] uppercase font-black tracking-widest ${isActive ? 'text-emerald-600/70' : 'text-gray-400'}">
                                        <i data-lucide="play-circle" class="w-3.5 h-3.5"></i> Video
                                    </span>
                                ` : ''}
                                ${m.has_quiz ? `
                                    <span class="flex items-center gap-1 text-[9px] uppercase font-black tracking-widest ${isActive ? 'text-purple-600/70' : 'text-gray-400'}">
                                        <i data-lucide="help-circle" class="w-3.5 h-3.5"></i> Quiz
                                    </span>
                                ` : `
                                    <span class="flex items-center gap-1 text-[9px] uppercase font-black tracking-widest ${isActive ? 'text-blue-600/70' : 'text-gray-400'}">
                                        <i data-lucide="file-text" class="w-3.5 h-3.5"></i> Read
                                    </span>
                                `}
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Active Indicator Bar -->
                <div class="absolute left-0 top-0 bottom-0 w-1.5 rounded-r-full bg-emerald-500 scale-y-0 transition-transform duration-300 origin-center ${isActive ? 'scale-y-100' : ''}"></div>
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

    const isLiveCohort = currentCourse.course_type === 'Live-Cohort';

    if (isLiveCohort && module.notes_url && module.notes_url.includes('meet.google.com')) {
        const days = currentCourse.cohort_days?.join(', ') || 'Not set';
        const startTime = currentCourse.start_time?.slice(0,5) || '--:--';
        const endTime = currentCourse.end_time?.slice(0,5) || '--:--';
        videoContainer.innerHTML = `
            <div class="absolute inset-0 flex flex-col items-center justify-center bg-white p-8 text-center">
                <div class="w-20 h-20 bg-emerald-50 flex items-center justify-center mb-6 border border-emerald-100">
                    <i data-lucide="video" class="w-10 h-10 text-emerald-600"></i>
                </div>
                <h3 class="text-xl font-black text-gray-900 mb-2">Live Session Ready</h3>
                <p class="text-sm text-gray-500 max-w-sm mb-4">Join the Google Meet session to attend your live class. Multiple students can join simultaneously.</p>
                <div class="flex items-center gap-4 mb-6 text-xs">
                    <div class="bg-emerald-50 border border-emerald-100 px-4 py-2 flex items-center gap-2">
                        <i data-lucide="calendar" class="w-3.5 h-3.5 text-emerald-600"></i>
                        <span class="font-bold text-emerald-700">${days}</span>
                    </div>
                    <div class="bg-blue-50 border border-blue-100 px-4 py-2 flex items-center gap-2">
                        <i data-lucide="clock" class="w-3.5 h-3.5 text-blue-600"></i>
                        <span class="font-bold text-blue-700">${startTime} - ${endTime}</span>
                    </div>
                </div>
                <a href="${module.notes_url}" target="_blank" class="inline-flex items-center gap-3 bg-emerald-600 text-white font-bold px-8 py-3 hover:bg-emerald-700 transition shadow-lg shadow-emerald-200 text-sm">
                    <i data-lucide="video" class="w-5 h-5"></i>
                    Join Google Meet
                    <i data-lucide="external-link" class="w-4 h-4 opacity-60"></i>
                </a>
                <div class="mt-6 flex items-center gap-2 text-xs text-gray-400 bg-gray-50 px-4 py-2 border border-gray-100">
                    <i data-lucide="message-circle" class="w-4 h-4 text-blue-400"></i>
                    <span>Use the <strong class="text-gray-600">Google Meet chat</strong> inside the meeting for live discussion</span>
                </div>
            </div>
        `;
        videoLinkContainer.innerHTML = `
            <a href="${module.notes_url}" target="_blank" class="flex items-center gap-2 text-xs font-black text-emerald-600 hover:text-emerald-700 transition">
                <span>Open Google Meet</span>
                <i data-lucide="external-link" class="w-3 h-3"></i>
            </a>
        `;
    } else if (module.video_url) {
        let embedUrl = module.video_url;
        const isDrive = embedUrl.includes('drive.google.com');
        const isYoutube = embedUrl.includes('youtube.com') || embedUrl.includes('youtu.be');

        if (isDrive) {
            embedUrl = embedUrl.replace('/view', '/preview').replace('/edit', '/preview');
            videoContainer.innerHTML = `<iframe src="${embedUrl}" class="absolute inset-0 w-full h-full" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
        } else if (isYoutube) {
            let videoId = '';
            try {
                if (embedUrl.includes('youtu.be/')) {
                    videoId = embedUrl.split('youtu.be/')[1].split('?')[0];
                } else if (embedUrl.includes('youtube.com/watch')) {
                    videoId = new URL(embedUrl).searchParams.get('v');
                } else if (embedUrl.includes('youtube.com/embed/')) {
                    videoId = embedUrl.split('youtube.com/embed/')[1].split('?')[0];
                }
            } catch (e) { }

            if (videoId) {
                embedUrl = `https://www.youtube.com/embed/${videoId}`;
            }
            videoContainer.innerHTML = `<iframe src="${embedUrl}" class="absolute inset-0 w-full h-full" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
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
        videoContainer.innerHTML = `<div class="absolute inset-0 flex items-center justify-center text-gray-500 bg-gray-950 font-black uppercase tracking-widest text-xs">No video or live session assigned</div>`;
        videoLinkContainer.innerHTML = `<p class="text-xs text-gray-400 italic">No link</p>`;
    }

    // Update Materials
    const materialsContainer = document.getElementById('materials-link-container');
    const materialsLink = isLiveCohort ? module.materials_url : module.notes_url;
    if (materialsLink) {
        materialsContainer.innerHTML = `
            <a href="${materialsLink}" target="_blank" class="flex items-center gap-2 text-xs font-black text-blue-600 hover:text-blue-700 transition">
                <span>${isLiveCohort ? 'View Study Materials' : 'Download PDF/Notes'}</span>
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
    const quizBtn = document.querySelector('#quiz-link-container button');
    
    currentQuiz = null; // Reset current quiz
    if (module.has_quiz) {
        quizSection.classList.remove('hidden');
        if (quizBtn) {
            quizBtn.disabled = true;
            quizBtn.innerHTML = '<span>Loading Quiz...</span><i data-lucide="loader" class="w-3 h-3 animate-spin"></i>';
            lucide.createIcons();
        }
        fetchModuleQuiz(module.id).then(() => {
            if (quizBtn) {
                quizBtn.disabled = false;
                quizBtn.innerHTML = '<span>Take Module Quiz</span><i data-lucide="help-circle" class="w-3 h-3"></i>';
                lucide.createIcons();
            }
        });
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
    if (!currentQuiz || !currentQuiz.questions) return alert("Quiz content is not available yet.");
    
    const overlay = document.getElementById('quiz-modal-overlay');
    const container = document.getElementById('quiz-questions-container');
    const title = document.getElementById('quiz-modal-title');

    const activeModule = currentModules[activeModuleIndex];
    title.textContent = `${activeModule ? activeModule.title : 'Module'} Quiz`;
    
    let parsedQuestions = currentQuiz.questions;
    if (typeof parsedQuestions === 'string') {
        try { parsedQuestions = JSON.parse(parsedQuestions); } catch(e) {}
    }

    // Filter out any undefined or null questions that might exist in the array
    const validQuestions = Array.isArray(parsedQuestions) ? parsedQuestions.filter(q => q && q.question) : [];

    if (validQuestions.length === 0) {
        container.innerHTML = '<div class="text-center py-20 text-gray-400 italic">No questions found for this quiz.</div>';
    } else {
        container.innerHTML = validQuestions.map((q, qIdx) => `
            <div class="mb-10 bg-white p-8 border border-emerald-800 shadow-sm last:mb-0">
                <div class="flex items-center gap-2 mb-4">
                    <span class="w-6 h-6 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center text-[10px] font-black uppercase">Q${qIdx + 1}</span>
                    <p class="text-[10px] font-black text-purple-600 uppercase tracking-widest">Question</p>
                </div>
                <h4 class="text-lg font-bold text-gray-900 mb-6 leading-tight">${q.question}</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    ${(q.options || []).map((opt, optIdx) => `
                        <label class="flex items-center gap-4 p-4 border border-gray-100 hover:border-purple-200 hover:bg-purple-50 transition cursor-pointer group relative">
                            <input type="radio" name="q-${qIdx}" value="${optIdx}" class="w-5 h-5 text-purple-600 focus:ring-purple-500 border-gray-200 transition-all cursor-pointer">
                            <div class="flex-1">
                                <span class="text-sm font-bold text-gray-600 group-hover:text-purple-900 transition-colors">${opt}</span>
                            </div>
                            <div class="absolute inset-y-0 left-0 w-1 bg-transparent group-hover:bg-purple-500 transition-all"></div>
                        </label>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }

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
    if (!currentQuiz || !currentQuiz.questions) return;
    
    let parsedQuestions = currentQuiz.questions;
    if (typeof parsedQuestions === 'string') {
        try { parsedQuestions = JSON.parse(parsedQuestions); } catch(e) {}
    }
    const validQuestions = Array.isArray(parsedQuestions) ? parsedQuestions.filter(q => q && q.question) : [];
    if (validQuestions.length === 0) return window.closeQuizModal();

    let score = 0;
    let allAnswered = true;

    validQuestions.forEach((q, idx) => {
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

    const questions = validQuestions; // Use valid ones for percentage calculation

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
            // Update local state
            const localIdx = currentModuleProgress.findIndex(p => p.id === existing.id);
            if (localIdx !== -1) {
                currentModuleProgress[localIdx].is_completed = true;
                currentModuleProgress[localIdx].quiz_score = percent;
            }
        } else {
            const { data: inserted } = await supabase.from('student_progress').insert({
                student_id: user.id,
                course_id: currentCourse.id,
                module_id: currentModules[activeModuleIndex].id,
                is_completed: true,
                quiz_score: percent,
                completed_at: new Date().toISOString()
            }).select().single();
            if (inserted) currentModuleProgress.push(inserted);
        }
        
        renderSidebar(); // Refresh sidebar icons
        updateProgressUI(); // Refresh overall course progress
        window.closeQuizModal();
        alert('Module completed successfully!');
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
        <div class="p-6 bg-white border border-emerald-800 shadow-sm transition">
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
            message: `A student commented on your course "${currentCourse.title}":\n\n"${content}" <!--COURSE:${currentCourse.id}|STUDENT:${user.id}-->`
        });

        input.value = '';
        loadComments();
    }

    btn.disabled = false;
    btn.textContent = 'Post Comment';
}

init();
