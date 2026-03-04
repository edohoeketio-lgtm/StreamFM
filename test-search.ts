import handler from './api/search.js';

async function test() {
    const req = {
        method: 'GET',
        query: {
            title: 'Secondhand',
            artist: 'Rema'
        }
    };

    // Mock res object
    const res = {
        setHeader: () => { },
        status: function (code: number) {
            return {
                json: function (data: any) {
                    console.log(`[Status ${code}] Result:`, data);
                    return data;
                },
                end: function () {
                    console.log(`[Status ${code}] Ended`);
                }
            };
        }
    };

    await handler(req as any, res as any);
}

test();
