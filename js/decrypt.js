document.addEventListener('DOMContentLoaded', () => {
    const privateContentSection = document.getElementById('private-content-section'); // The entire section
    const passwordForm = document.getElementById('password-form');
    const passwordInput = document.getElementById('password-input');
    const privateContentContainer = document.getElementById('private-content-container'); // This is where decrypted posts will go

    if (!privateContentSection || !passwordForm || !privateContentContainer) {
        // If these elements don't exist (e.g., on a single post page), do nothing.
        return;
    }

    passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = passwordInput.value;
        if (!password) {
            alert('Please enter a password.');
            return;
        }

        try {
            const response = await fetch('/data/private.json');
            if (!response.ok) {
                throw new Error('Could not load private posts data.');
            }
            const data = await response.json();
            
            const decryptedPosts = decryptPosts(data.posts, password);

            // Check if at least one post was successfully decrypted (as a canary for password correctness)
            const successfullyDecryptedCount = decryptedPosts.filter(p => p.content !== null).length;

            if (data.posts.length > 0 && successfullyDecryptedCount === 0) {
                // If there were private posts, but none decrypted, assume incorrect password
                alert('Incorrect password.');
            } else {
                // If password is correct, or no private posts exist, hide the form
                passwordForm.style.display = 'none';
                
                if (successfullyDecryptedCount > 0) {
                    await displayPosts(decryptedPosts.filter(p => p.content !== null)); // Only display successfully decrypted ones
                } else {
                    privateContentContainer.innerHTML = '<p>No private posts to display or all failed decryption.</p>';
                }
            }

        } catch (error) {
            console.error('Decryption failed:', error);
            alert('An error occurred during decryption: ' + error.message);
        }
    });

    function decryptPosts(posts, password) {
        return posts.map(post => {
            try {
                const bytes = CryptoJS.AES.decrypt(post.content, password);
                // Check if any actual data was decrypted
                if (bytes.sigBytes === 0) {
                    console.warn(`Failed to decrypt post: "${post.title}". Incorrect password or corrupted data.`);
                    return { ...post, content: null }; // Mark as failed
                }
                const originalText = bytes.toString(CryptoJS.enc.Utf8);
                return { ...post, content: originalText };
            } catch (e) {
                console.error(`Error during decryption of post "${post.title}":`, e);
                return { ...post, content: null }; // Mark as failed
            }
        });
    }

    async function displayPosts(postsToDisplay) { // Renamed parameter for clarity
        const publicPostList = document.querySelector('.main .post-list'); // Existing public post container
        const privatePostsHtml = [];

        // Build HTML for decrypted private posts
        for (const post of postsToDisplay) {
            const postHtml = `
                <article class="post-entry">
                    <header class="entry-header">
                        <h2>${post.title} <sup style="color: red;">[Private]</sup></h2>
                    </header>
                    <div class="entry-content">
                        <p>${post.content.substring(0, 250)}...</p>
                    </div>
                    <footer class="entry-footer">
                        <span>${new Date(post.date).toLocaleDateString()}</span>
                        <a href="${post.permalink}">Read more...</a>
                    </footer>
                </article>
            `;
            privatePostsHtml.push({ html: postHtml, date: new Date(post.date) }); // Store with date for sorting
        }

        // Get existing public posts
        const existingPublicPosts = publicPostList ? Array.from(publicPostList.children).map(el => {
            const dateSpan = el.querySelector('.entry-footer span');
            return {
                html: el.outerHTML,
                date: dateSpan ? new Date(dateSpan.textContent) : new Date(0) // Default to epoch for robust sorting
            };
        }) : [];

        // Combine and sort all posts
        const allPostsCombined = [...existingPublicPosts, ...privatePostsHtml];
        allPostsCombined.sort((a, b) => b.date.getTime() - a.date.getTime()); // Sort by date descending

        // Clear and re-render the public post list (or append if no existing public posts container)
        if (publicPostList) {
            publicPostList.innerHTML = ''; // Clear existing
            allPostsCombined.forEach(item => {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = item.html;
                publicPostList.appendChild(tempDiv.firstElementChild);
            });
        } else {
             // If no existing public post list, append to privateContentContainer
            privateContentContainer.innerHTML = '';
            allPostsCombined.forEach(item => {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = item.html;
                privateContentContainer.appendChild(tempDiv.firstElementChild);
            });
        }
    }
});