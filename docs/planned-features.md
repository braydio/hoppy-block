• Feature Notes                                                                                [0/1039]
                                                                                                       
  - RPG-style progression                                                                              
      - Start the player with no powerups; introduce randomized item drops (or score thresholds) that  
        grant the first power, with the earliest drop gated behind some minimum score or condition.    
      - Holds once earned—powerups persist across deaths/runs.                                         
  - Upgradeable abilities                                                                              
      - Allow each power to begin very weak and be upgradable by spending either points, a dedicated   
        currency, or earned experience.                                                                
      - The charge bar itself is upgradeable: start with no charge, get a minimal pool when the first  
        power drops, and expand it with further upgrades.                                              
  - Achievement & scoreboard expansion                                                                 
      - Add a richer achievement system tied to gameplay, the power progression, etc.                  
      - Improve the scoreboard to highlight these new achievements and progression milestones.         
  - Audio metadata tracking                                                                            
      - Record metadata for each uploaded track (e.g., title, artist, duration) so the game knows which
        ones the player has played.                                                                    
      - Let achievements reference this data (e.g., “completed an entire album”), and use it to surface
        stats like most-played or highest-difficulty tracks.
      - Eventually roll up global stats tied to tracks (popularity, difficulty tier, etc.) to inform
        future UI or matchmaking.                                                                      

- RPG-style progression deep dive                                                                        
      - Seed the run with no inherent powerups so the first handful of minutes are focused on survival,
        then unlock a safe “item drop window” (score thresholds, timing bonuses, or random chests) that
        actually yields a basic power.                                                                    
      - Consider a two-layer gating system: the new power can only drop once the player hits a minimum
        score or combo, then after that it appears randomly in the common loot pool to keep runs fresh.    
      - Once collected the power is “bound” to the profile—allow players to bring it into future runs even
        after death while enforcing a soft cap (e.g., rare resets still wipe everything).                   
      - Sketch how multiple powers chain together: maybe the first unlock unlocks a skill tree node that
        reduces cooldowns later, or the player can choose between divergent upgrade paths mid-run.        

- Upgrade systems & charge economy                                                                         
      - Let upgrades consume different currencies: score fragments for small bumps, a rarer “charge
        crystal” for major unlocking, or a persistent XP meter gained through achievements.                
      - Make each ability start with a basic effect (e.g., weak slow-mo), then add tiers (longer duration,
        more projectiles, bonus effects) that scale with currency spent.                                    
      - Tie the charge bar itself into progression: no default charge, the first acquired power grants a
        minimal meter; future upgrades expand capacity, reduce drain, or grant instant bursts at start.      
      - Introduce “power combos” (e.g., damage + speed) unlocked when two powers reach matching ranks, to
        encourage players to diversify who they upgrade rather than min-maxing a single power.            

- Achievement, scoreboard, and progression psychology                                                        
      - Build a tiered achievement board (daily/weekly/legendary) that links to the new RPG systems:
        “Reach power level 3 before the second checkpoint,” “Upgrade the charge bar three times,” etc.
      - Improve the scoreboard UI so it highlights streaks, upgrades earned, and achievement badges next to
        each run; consider filtering by mode, track, or player-defined tags.                                
      - Reward persistence with meta progression: completing achievements grants bonus XP/currency, and a
        global leaderboard can show who has the widest variety of upgraded powers.                          

- Audio tracking + global meta                                                                              
      - Store richer metadata for each uploaded track (file hash, length, BPM, sample rate, artless tags),
        link it to player history so completions and stats survive reinstalls.                          
      - Use that data to unlock new achievements (“Played every track tagged jazz this month,” “Beat
        mode on a 120+ BPM song”), and let achievements reference owned/played tracks, not just global
        counts.                                                                                          
      - Surface the data in a “Track Library” screen (played count, win rate, difficulty estimate, top
        combo) and let players mark favorites; use it later for matchmaking by difficulty or by songs
        the community tags as “sweaty.”                                                                  
      - Collect anonymous global stats for each track—play counts, failure rates, difficulty ratings—that
        can influence future tuning and highlight trending music.                                        

- Persistent meta gamification                                                                             
      - Introduce a “campaign map” or progression tree that unlocks new challenge tiers, narrative flavor,
        or cosmetics as players upgrade powers/charge.                                                    
      - Allow cosmetic rewards tied to achievements and track stats (an emblem for finishing an album,
        a skin for powering-up the charge bar fully).                                                        
      - Consider a “seasonal pass” style track where each season introduces new power variants, limited
        time upgrades, and album-specific milestones.                                                     
                                     
