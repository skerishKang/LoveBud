/**
 * LoveBud - Settings Module
 * v20260416-1
 * 
 * 사용자 설정 관리 (localStorage 기반)
 * - defaultVisibility: 새 트리의 기본 공개 여부
 * - profileName: 사용자 프로필 이름
 */

(function() {
    // 설정 저장소 key
    var SETTINGS_KEY = 'lovebud_user_settings';

    // 기본값
    var DEFAULT_SETTINGS = {
        defaultVisibility: 'private',
        profileName: ''
    };

    // 설정 읽기
    window.getSettings = function() {
        try {
            var raw = localStorage.getItem(SETTINGS_KEY);
            if (!raw || raw === 'null') return Object.assign({}, DEFAULT_SETTINGS);
            var parsed = JSON.parse(raw);
            return Object.assign({}, DEFAULT_SETTINGS, parsed);
        } catch (e) {
            return Object.assign({}, DEFAULT_SETTINGS);
        }
    };

    // 설정 저장
    window.saveSettings = function(newSettings) {
        try {
            var current = window.getSettings();
            var updated = Object.assign({}, current, newSettings);
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
            return updated;
        } catch (e) {
            console.warn('[settings] Failed to save:', e);
            return null;
        }
    };

    // 특정 설정값 읽기
    window.getSetting = function(key) {
        var settings = window.getSettings();
        return settings[key] !== undefined ? settings[key] : DEFAULT_SETTINGS[key];
    };

    // 새 트리 생성 시 사용할 기본 공개 여부
    window.getDefaultVisibility = function() {
        return window.getSetting('defaultVisibility') || 'private';
    };

    // 프로필 이름 가져오기
    window.getProfileName = function() {
        return window.getSetting('profileName') || '';
    };

    // 설정 렌더링 (settings.html에서 사용)
    window.renderSettings = function() {
        var settings = window.getSettings();
        
        // visibility 토글 업데이트
        var toggle = document.getElementById('visibilityToggle');
        if (toggle) {
            toggle.checked = settings.defaultVisibility === 'public';
        }
        
        // profile 이름 업데이트
        var profileInput = document.getElementById('profileNameInput');
        if (profileInput) {
            profileInput.value = settings.profileName || '';
        }
    };

    // 공개 여부 토글 변경 시
    window.onVisibilityChange = function(isPublic) {
        var visibility = isPublic ? 'public' : 'private';
        window.saveSettings({ defaultVisibility: visibility });
        console.log('[settings] defaultVisibility changed to:', visibility);
    };

    // 프로필 이름 변경 시
    window.onProfileNameChange = function(name) {
        window.saveSettings({ profileName: name });
        console.log('[settings] profileName changed to:', name);
    };

    // 설정 초기화 (테스트용)
    window.resetSettings = function() {
        localStorage.removeItem(SETTINGS_KEY);
        console.log('[settings] Settings reset to defaults');
    };
})();