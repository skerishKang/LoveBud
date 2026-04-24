const moments = {
    "first-stage": {
        title: "첫 무대를 본 밤",
        description: "처음으로 화면을 멈춰두고 다시 본 순간입니다. 이 트리의 가장 아래 기억으로 두고 싶었습니다.",
        tags: ["#입덕", "#설렘", "#첫순간"],
        media: "stage memory"
    },
    "concert-light": {
        title: "응원봉이 켜진 자리",
        description: "공연장 조명이 바뀌던 장면과 팬들의 목소리가 같이 저장된 가지입니다.",
        tags: ["#콘서트", "#벅참", "#빛"],
        media: "concert light"
    },
    "comeback-day": {
        title: "컴백 티저를 기다리던 날",
        description: "자정 전부터 새로고침하던 마음을 하나의 노드로 남긴 테스트 데이터입니다.",
        tags: ["#컴백", "#기대", "#기록"],
        media: "comeback teaser"
    },
    "friend-chat": {
        title: "친구와 오래 나눈 말",
        description: "같은 장면을 좋아하는 사람과 대화하며 마음이 더 커졌던 기억입니다.",
        tags: ["#공유", "#다정함", "#대화"],
        media: "chat note"
    },
    "favorite-clip": {
        title: "계속 돌려본 짧은 클립",
        description: "몇 초짜리 장면이 하루의 분위기를 바꿔서, 가지 끝에 밝은 노드로 배치했습니다.",
        tags: ["#클립", "#반복재생", "#최애"],
        media: "favorite clip"
    },
    "saved-ticket": {
        title: "간직한 티켓 조각",
        description: "종이 한 장처럼 작지만 트리 위쪽까지 이어지는 오래 남은 감정입니다.",
        tags: ["#티켓", "#간직", "#추억"],
        media: "ticket scrap"
    }
};

const nodes = Array.from(document.querySelectorAll(".tree-node"));
const emptyState = document.querySelector("[data-empty-state]");
const panelContent = document.querySelector("[data-panel-content]");
const panelTitle = document.querySelector("[data-panel-title]");
const panelDescription = document.querySelector("[data-panel-description]");
const panelTags = document.querySelector("[data-panel-tags]");
const mediaLabel = document.querySelector("[data-media-label]");

function renderMoment(momentId) {
    const moment = moments[momentId];
    if (!moment) return;

    nodes.forEach((node) => {
        node.classList.toggle("is-active", node.dataset.momentId === momentId);
        node.setAttribute("aria-pressed", String(node.dataset.momentId === momentId));
    });

    emptyState.hidden = true;
    panelContent.hidden = false;
    panelTitle.textContent = moment.title;
    panelDescription.textContent = moment.description;
    mediaLabel.textContent = moment.media;

    panelTags.replaceChildren(...moment.tags.map((tag) => {
        const item = document.createElement("span");
        item.textContent = tag;
        return item;
    }));
}

nodes.forEach((node) => {
    node.setAttribute("aria-pressed", "false");
    node.addEventListener("click", () => renderMoment(node.dataset.momentId));
});
