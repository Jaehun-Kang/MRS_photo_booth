
export const templateFilter5 = {
  // params: {
  //   opacity: {
  //     value: 0.5,
  //     min: 0.1,
  //     max: 1.0,
  //     step: 0.1,
  //     label: "투명도",
  //   },
  // },

  // setup(p5js) {
  //   this.opacity = this.params.opacity.value;
  //   p5js.colorMode(p5js.RGB, 255);
  // },

  // updateParams(params) {
  //   if (params.opacity !== undefined) this.opacity = params.opacity;
  // },

  // draw(p5js, offscreen, canvasW, canvasH, captureW, captureH) {
  //   // 기존 이미지를 먼저 그리기
  //   p5js.image(offscreen, 0, 0, canvasW, canvasH);

  //   // 화면을 가로 세로 반씩 4등분
  //   const halfWidth = Math.floor(captureW / 2);
  //   const halfHeight = Math.floor(captureH / 2);

  //   // 4개의 사분면 정의
  //   const segments = [
  //     { x: 0, y: 0, w: halfWidth, h: halfHeight }, // 좌상
  //     { x: halfWidth, y: 0, w: captureW - halfWidth, h: halfHeight }, // 우상
  //     { x: 0, y: halfHeight, w: halfWidth, h: captureH - halfHeight }, // 좌하
  //     {
  //       x: halfWidth,
  //       y: halfHeight,
  //       w: captureW - halfWidth,
  //       h: captureH - halfHeight,
  //     }, // 우하
  //   ];

  //   // 각 사분면을 전체 화면으로 확대하여 투명도로 겹치기
  //   p5js.tint(255, this.opacity * 255);

  //   for (let i = 0; i < segments.length; i++) {
  //     const segment = segments[i];

  //     // 해당 영역의 이미지 추출
  //     const segmentImg = offscreen.get(
  //       segment.x,
  //       segment.y,
  //       segment.w,
  //       segment.h
  //     );

  //     // 전체 캔버스 크기로 확대하여 그리기
  //     p5js.image(segmentImg, 0, 0, canvasW, canvasH);
  //   }

  //   // tint 초기화
  //   p5js.noTint();
  // },
  setup(p5js) {},

  draw(p5js, offscreen, canvasW, canvasH, captureW, captureH) {
    p5js.image(offscreen, 0, 0, canvasW, canvasH);

  },
};
