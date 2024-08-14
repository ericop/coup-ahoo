import { Ball } from './ball';
import { fabrics, woods } from './colors';
import { Dice } from './dice';
import { Dude } from './dude';
import { Camera } from './engine/camera';
import { font } from './engine/constants';
import { drawCircle } from './engine/drawing';
import { quadEaseIn, quadEaseInOut } from './engine/easings';
import { Entity } from './engine/entity';
import { Game } from './engine/game';
import { Mouse } from './engine/mouse';
import { Pulse } from './engine/pulse';
import { randomCell } from './engine/random';
import { offset, Vector } from './engine/vector';
import { Scene } from './scene';

export class Ship extends Entity {
    private dude: Dude;
    private phase: number;
    private dice: Dice[] = [];
    private mp: Vector;
    private colors: string[];
    private opponent: Ship;
    private recoil: number = 0;
    private stagger: number = 0;
    private incoming: number = 0;
    private ball: Ball;
    
    constructor(game: Game, private name: string, x: number, private scene: Scene, private player: boolean) {
        super(game, x, 550, 0, 0);
        this.colors = [
            randomCell(woods),
            randomCell(woods),
            randomCell(woods),
            randomCell(fabrics),
            randomCell(fabrics)
        ];
        this.dude = new Dude(game, 50, -100, this.colors[4], this.colors[3], randomCell(woods));
    }

    public setBall(ball: Ball) {
        this.ball = ball;
    }

    public isAuto(): boolean {
        return !this.player;
    }

    public getOpponent(): Ship {
        return this.opponent;
    }

    public setOpponent(other: Ship): void {
        this.opponent = other;
    }

    public isDead(): boolean {
        return this.dice.length === 0;
    }

    public addDamage(dmg: number): void {
        if (dmg <= 0) {
            this.scene.nextTurn();
            return;
        }
        this.incoming = dmg;
        this.dice.forEach(d => d.allowPick());
    }

    public hurt(amount: number): void {
        const target = this.dice.find(d => d.getValue() > amount) ?? this.dice.sort((a, b) => a.getValue() - b.getValue())[0];
        if (!target) return;
        this.hurtDice(target, amount);
    }

    public hurtDice(target: Dice, amount: number): void {
        target.mark();
        setTimeout(() => {
            this.game.getCamera().shake(10, 0.15, 1);
            const dir = this.player ? 1 : -1;
            const pos = offset(this.p, dir * -50, -this.p.y + 340);
            this.pulse(pos.x + 40, pos.y, 150);   
            if (target.hurt(amount)) {
                this.dice = this.dice.filter(d => d != target);
                this.repositionDice();
            }
            this.stagger = 1;
        }, 500);
    }

    public shootAnim(): void {
        this.dude.hopInPlace();
        setTimeout(() => this.dude.pose(false), 300);
        this.recoil = 1;
        this.stagger = 1;
        const dir = this.player ? 1 : -1;
        const muzzle = offset(this.p, dir * 300, -this.p.y + 340);
        this.ball.shoot(muzzle, 800 * dir);
        this.game.getCamera().shake(5, 0.1, 1);
        this.pulse(muzzle.x + 40, muzzle.y, 80);
    }

    public shoot(damage: number): void {
        this.shootAnim();
        this.opponent?.hurt(damage);
        setTimeout(() => this.scene.nextTurn(), 500);
    }

    public pulse(x: number, y: number, size: number): void {
        this.game.getScene().add(new Pulse(this.game, x, y, size, 0.15, 0, 150));
    }

    public addDice(d: Dice): void {
        this.dice.push(d);
        d.p = this.getDicePos(this.dice.length - 1);
        this.repositionDice();
    }

    public getDiceCount(): number {
        return this.dice.length;
    }

    public getDicePos(i: number): Vector {
        return {
            x: -105 * Math.floor(i / 3) - 180 + Math.random() * 20,
            y: (i % 3) * -100 - 240
        };
    }

    public repositionDice(): void {
        this.dice.forEach((d, i) => d.move(this.getDicePos(i)));
    }

    public notDone(): boolean {
        return this.incoming > 0;
    }

    public update(tick: number, mouse: Mouse): void {
        super.update(tick, mouse);
        this.phase = Math.sin(tick * 0.005);
        this.dude.update(tick, mouse);
        this.dice.forEach(d => d.update(tick, this.offsetMouse(mouse, this.game.getCamera())));
        this.mp = this.offsetMouse(mouse, this.game.getCamera());
        if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - 0.075);
        if (this.stagger > 0) this.stagger = Math.max(0, this.stagger - 0.05);

        if (this.incoming > 0 && mouse.pressing) {
            const d = this.dice.find(d => d.isHovering());
            if (d) {
                this.opponent.shootAnim();
                this.hurtDice(d, this.incoming);
                this.incoming = 0;
                this.dice.forEach(dd => dd.allowPick(false));
                setTimeout(() => this.scene.nextTurn(), 500);
            }
        }
    }

    public offsetMouse(mouse: Mouse, cam: Camera, x: number = 0, y: number = 0): Mouse {
        return {
            ...mouse,
            x: mouse.x / cam.zoom - 400 + cam.shift + x,
            y: mouse.y / cam.zoom - 550 - cam.pan.y + y
        };
    }

    public sink(): void {
        this.dude.hopInPlace();
        this.tween.setEase(quadEaseIn);
        this.tween.move(offset(this.p, 0, 550), 1);
    }

    public pose(state: boolean): void {
        this.dude.pose(state);
    }

    public draw(ctx: CanvasRenderingContext2D): void {
        ctx.save();
        const mirror = this.player ? 1 : -1;
        ctx.translate(this.p.x - this.stagger * 20 * mirror, this.p.y);
        ctx.rotate(this.phase * 0.02 - this.stagger * 0.05 * mirror);

        if (!this.player) ctx.scale(-1, 1);

        // mast
        ctx.fillStyle = this.colors[0];
        const mastPos = 40;
        ctx.beginPath();
        ctx.rect(-50 + mastPos, -550, 15, 600);
        ctx.fill();
        ctx.stroke();
        ctx.closePath();

        // sail
        ctx.fillStyle = this.colors[3];
        ctx.beginPath();
        ctx.moveTo(-60 + mastPos, -520);
        ctx.lineTo(-60 + mastPos, -200);
        ctx.lineTo(-300 + mastPos - this.phase * 10, -200 - this.phase * 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // draw mouse point
        // if (this.player) ctx.fillRect(this.mp.x, this.mp.y, 20, 20);

        // const cam = this.game.getCamera();
        // const off = cam.pan.x / cam.zoom + (this.player ? 800 : -700);
        // ctx.translate(-this.p.x + off, -this.p.y);
        this.dice.forEach(d => d.draw(ctx));
        this.dice.forEach(d => d.drawRim(ctx));
        // ctx.translate(this.p.x - off, this.p.y);

        ctx.translate(120, 0);
        this.drawCannon(ctx);
        ctx.translate(-120, 0);

        ctx.save();
        ctx.scale(1.4, 1.4);
        this.dude.draw(ctx);
        ctx.restore();

        // hull
        ctx.fillStyle = this.colors[2];
        ctx.beginPath();
        const extension = this.getCargoWidth();
        ctx.moveTo(-200 - extension, -150);
        ctx.lineTo(-170 - extension, 150);
        ctx.lineTo(180, 150);
        ctx.lineTo(250, -160);
        ctx.closePath();
        ctx.moveTo(-200 - extension, -110);
        ctx.lineTo(250 - 10, -120);
        ctx.moveTo(-200 - extension + 5, -72);
        ctx.lineTo(250 - 15, -77);
        ctx.fill();
        ctx.stroke();

        ctx.translate(-120, -100);
        ctx.scale(this.player ? 1 : -1, 1);
        ctx.lineWidth = 12;
        ctx.fillStyle = this.colors[4];
        ctx.font =`40px ${font}`;
        ctx.textAlign = 'center';
        ctx.strokeText(this.name, 0, 0);
        ctx.fillText(this.name, 0, 0);

        ctx.restore();
    }

    public sail(): void {
        this.dude.hopInPlace();
        this.tween.setEase(quadEaseInOut);
        this.tween.move(offset(this.p, 2000, 0), 6);
    }

    public getCargoWidth(): number {
        return Math.floor(Math.max(0, this.dice.length - 1) / 3) * 100;
    }

    private drawCannon(ctx: CanvasRenderingContext2D): void {
        ctx.fillStyle = '#666';
        // cannon
        ctx.save();
        ctx.rotate(-this.recoil * 0.2);
        ctx.translate(190 - this.recoil * 10, 0);
        ctx.beginPath();
        const height = 25;
        ctx.moveTo(0, -200 - height);
        ctx.bezierCurveTo(-300, -200 - height * 2, -300, -200 + height * 2, 0, -200 + height);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = this.colors[1];
        // cannon base
        ctx.beginPath();
        ctx.moveTo(0, -150);
        ctx.bezierCurveTo(0, -230, 70, -230, 70, -150);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        drawCircle(ctx, { x: 35, y: -190 }, 8, '#000');
    }
}